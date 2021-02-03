import { createWriteStream } from 'fs'
import { ensureDir, move, pathExists, remove, writeFile } from 'fs-extra'
import { join } from 'path'
import * as request from 'request'
import { CONFIG } from '@server/initializers/config'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'
import { VideoResolution } from '../../shared/models/videos'
import { CONSTRAINTS_FIELDS, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '../initializers/constants'
import { getEnabledResolutions } from '../lib/video-transcoding'
import { peertubeTruncate, root } from './core-utils'
import { isVideoFileExtnameValid } from './custom-validators/videos'
import { logger } from './logger'
import { generateVideoImportTmpPath } from './utils'

export type YoutubeDLInfo = {
  name?: string
  description?: string
  category?: number
  language?: string
  licence?: number
  nsfw?: boolean
  tags?: string[]
  thumbnailUrl?: string
  ext?: string
  originallyPublishedAt?: Date
}

export type YoutubeDLSubs = {
  language: string
  filename: string
  path: string
}[]

const processOptions = {
  maxBuffer: 1024 * 1024 * 10 // 10MB
}

function getYoutubeDLInfo (url: string, opts?: string[]): Promise<YoutubeDLInfo> {
  return new Promise<YoutubeDLInfo>((res, rej) => {
    let args = opts || [ '-j', '--flat-playlist' ]

    if (CONFIG.IMPORT.VIDEOS.HTTP.FORCE_IPV4) {
      args.push('--force-ipv4')
    }

    args = wrapWithProxyOptions(args)
    args = [ '-f', getYoutubeDLVideoFormat() ].concat(args)

    safeGetYoutubeDL()
      .then(youtubeDL => {
        youtubeDL.getInfo(url, args, processOptions, (err, info) => {
          if (err) return rej(err)
          if (info.is_live === true) return rej(new Error('Cannot download a live streaming.'))

          const obj = buildVideoInfo(normalizeObject(info))
          if (obj.name && obj.name.length < CONSTRAINTS_FIELDS.VIDEOS.NAME.min) obj.name += ' video'

          return res(obj)
        })
      })
      .catch(err => rej(err))
  })
}

function getYoutubeDLSubs (url: string, opts?: object): Promise<YoutubeDLSubs> {
  return new Promise<YoutubeDLSubs>((res, rej) => {
    const cwd = CONFIG.STORAGE.TMP_DIR
    const options = opts || { all: true, format: 'vtt', cwd }

    safeGetYoutubeDL()
      .then(youtubeDL => {
        youtubeDL.getSubs(url, options, (err, files) => {
          if (err) return rej(err)
          if (!files) return []

          logger.debug('Get subtitles from youtube dl.', { url, files })

          const subtitles = files.reduce((acc, filename) => {
            const matched = filename.match(/\.([a-z]{2})\.(vtt|ttml)/i)
            if (!matched || !matched[1]) return acc

            return [
              ...acc,
              {
                language: matched[1],
                path: join(cwd, filename),
                filename
              }
            ]
          }, [])

          return res(subtitles)
        })
      })
      .catch(err => rej(err))
  })
}

function getYoutubeDLVideoFormat () {
  /**
   * list of format selectors in order or preference
   * see https://github.com/ytdl-org/youtube-dl#format-selection
   *
   * case #1 asks for a mp4 using h264 (avc1) and the exact resolution in the hope
   * of being able to do a "quick-transcode"
   * case #2 is the first fallback. No "quick-transcode" means we can get anything else (like vp9)
   * case #3 is the resolution-degraded equivalent of #1, and already a pretty safe fallback
   *
   * in any case we avoid AV1, see https://github.com/Chocobozzz/PeerTube/issues/3499
   **/
  const enabledResolutions = getEnabledResolutions('vod')
  const resolution = enabledResolutions.length === 0
    ? VideoResolution.H_720P
    : Math.max(...enabledResolutions)

  return [
    `bestvideo[vcodec^=avc1][height=${resolution}]+bestaudio[ext=m4a]`, // case #1
    `bestvideo[vcodec!*=av01][vcodec!*=vp9.2][height=${resolution}]+bestaudio`, // case #2
    `bestvideo[vcodec^=avc1][height<=${resolution}]+bestaudio[ext=m4a]`, // case #3
    `bestvideo[vcodec!*=av01][vcodec!*=vp9.2]+bestaudio`,
    'best[vcodec!*=av01][vcodec!*=vp9.2]', // case fallback for known formats
    'best' // Ultimate fallback
  ].join('/')
}

function downloadYoutubeDLVideo (url: string, fileExt: string, timeout: number) {
  // Leave empty the extension, youtube-dl will add it
  const pathWithoutExtension = generateVideoImportTmpPath(url, '')

  let timer

  logger.info('Importing youtubeDL video %s to %s', url, pathWithoutExtension)

  let options = [ '-f', getYoutubeDLVideoFormat(), '-o', pathWithoutExtension ]
  options = wrapWithProxyOptions(options)

  if (process.env.FFMPEG_PATH) {
    options = options.concat([ '--ffmpeg-location', process.env.FFMPEG_PATH ])
  }

  logger.debug('YoutubeDL options for %s.', url, { options })

  return new Promise<string>((res, rej) => {
    safeGetYoutubeDL()
      .then(youtubeDL => {
        youtubeDL.exec(url, options, processOptions, async err => {
          clearTimeout(timer)

          try {
            // If youtube-dl did not guess an extension for our file, just use .mp4 as default
            if (await pathExists(pathWithoutExtension)) {
              await move(pathWithoutExtension, pathWithoutExtension + '.mp4')
            }

            const path = await guessVideoPathWithExtension(pathWithoutExtension, fileExt)

            if (err) {
              remove(path)
                .catch(err => logger.error('Cannot delete path on YoutubeDL error.', { err }))

              return rej(err)
            }

            return res(path)
          } catch (err) {
            return rej(err)
          }
        })

        timer = setTimeout(() => {
          const err = new Error('YoutubeDL download timeout.')

          guessVideoPathWithExtension(pathWithoutExtension, fileExt)
            .then(path => remove(path))
            .finally(() => rej(err))
            .catch(err => {
              logger.error('Cannot remove file in youtubeDL timeout.', { err })
              return rej(err)
            })
        }, timeout)
      })
      .catch(err => rej(err))
  })
}

// Thanks: https://github.com/przemyslawpluta/node-youtube-dl/blob/master/lib/downloader.js
// We rewrote it to avoid sync calls
async function updateYoutubeDLBinary () {
  logger.info('Updating youtubeDL binary.')

  const binDirectory = join(root(), 'node_modules', 'youtube-dl', 'bin')
  const bin = join(binDirectory, 'youtube-dl')
  const detailsPath = join(binDirectory, 'details')
  const url = process.env.YOUTUBE_DL_DOWNLOAD_HOST || 'https://yt-dl.org/downloads/latest/youtube-dl'

  await ensureDir(binDirectory)

  return new Promise<void>(res => {
    request.get(url, { followRedirect: false }, (err, result) => {
      if (err) {
        logger.error('Cannot update youtube-dl.', { err })
        return res()
      }

      if (result.statusCode !== HttpStatusCode.FOUND_302) {
        logger.error('youtube-dl update error: did not get redirect for the latest version link. Status %d', result.statusCode)
        return res()
      }

      const url = result.headers.location
      const downloadFile = request.get(url)
      const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(url)[1]

      downloadFile.on('response', result => {
        if (result.statusCode !== HttpStatusCode.OK_200) {
          logger.error('Cannot update youtube-dl: new version response is not 200, it\'s %d.', result.statusCode)
          return res()
        }

        const writeStream = createWriteStream(bin, { mode: 493 }).on('error', err => {
          logger.error('youtube-dl update error in write stream', { err })
          return res()
        })

        downloadFile.pipe(writeStream)
      })

      downloadFile.on('error', err => {
        logger.error('youtube-dl update error.', { err })
        return res()
      })

      downloadFile.on('end', () => {
        const details = JSON.stringify({ version: newVersion, path: bin, exec: 'youtube-dl' })
        writeFile(detailsPath, details, { encoding: 'utf8' }, err => {
          if (err) {
            logger.error('youtube-dl update error: cannot write details.', { err })
            return res()
          }

          logger.info('youtube-dl updated to version %s.', newVersion)
          return res()
        })
      })
    })
  })
}

async function safeGetYoutubeDL () {
  let youtubeDL

  try {
    youtubeDL = require('youtube-dl')
  } catch (e) {
    // Download binary
    await updateYoutubeDLBinary()
    youtubeDL = require('youtube-dl')
  }

  return youtubeDL
}

function buildOriginallyPublishedAt (obj: any) {
  let originallyPublishedAt: Date = null

  const uploadDateMatcher = /^(\d{4})(\d{2})(\d{2})$/.exec(obj.upload_date)
  if (uploadDateMatcher) {
    originallyPublishedAt = new Date()
    originallyPublishedAt.setHours(0, 0, 0, 0)

    const year = parseInt(uploadDateMatcher[1], 10)
    // Month starts from 0
    const month = parseInt(uploadDateMatcher[2], 10) - 1
    const day = parseInt(uploadDateMatcher[3], 10)

    originallyPublishedAt.setFullYear(year, month, day)
  }

  return originallyPublishedAt
}

// ---------------------------------------------------------------------------

export {
  updateYoutubeDLBinary,
  getYoutubeDLVideoFormat,
  downloadYoutubeDLVideo,
  getYoutubeDLSubs,
  getYoutubeDLInfo,
  safeGetYoutubeDL,
  buildOriginallyPublishedAt
}

// ---------------------------------------------------------------------------

async function guessVideoPathWithExtension (tmpPath: string, sourceExt: string) {
  if (!isVideoFileExtnameValid(sourceExt)) {
    throw new Error('Invalid video extension ' + sourceExt)
  }

  const extensions = [ sourceExt, '.mp4', '.mkv', '.webm' ]

  for (const extension of extensions) {
    const path = tmpPath + extension

    if (await pathExists(path)) return path
  }

  throw new Error('Cannot guess path of ' + tmpPath)
}

function normalizeObject (obj: any) {
  const newObj: any = {}

  for (const key of Object.keys(obj)) {
    // Deprecated key
    if (key === 'resolution') continue

    const value = obj[key]

    if (typeof value === 'string') {
      newObj[key] = value.normalize()
    } else {
      newObj[key] = value
    }
  }

  return newObj
}

function buildVideoInfo (obj: any): YoutubeDLInfo {
  return {
    name: titleTruncation(obj.title),
    description: descriptionTruncation(obj.description),
    category: getCategory(obj.categories),
    licence: getLicence(obj.license),
    language: getLanguage(obj.language),
    nsfw: isNSFW(obj),
    tags: getTags(obj.tags),
    thumbnailUrl: obj.thumbnail || undefined,
    originallyPublishedAt: buildOriginallyPublishedAt(obj),
    ext: obj.ext
  }
}

function titleTruncation (title: string) {
  return peertubeTruncate(title, {
    length: CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
    separator: /,? +/,
    omission: ' […]'
  })
}

function descriptionTruncation (description: string) {
  if (!description || description.length < CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.min) return undefined

  return peertubeTruncate(description, {
    length: CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max,
    separator: /,? +/,
    omission: ' […]'
  })
}

function isNSFW (info: any) {
  return info.age_limit && info.age_limit >= 16
}

function getTags (tags: any) {
  if (Array.isArray(tags) === false) return []

  return tags
    .filter(t => t.length < CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
    .map(t => t.normalize())
    .slice(0, 5)
}

function getLicence (licence: string) {
  if (!licence) return undefined

  if (licence.includes('Creative Commons Attribution')) return 1

  for (const key of Object.keys(VIDEO_LICENCES)) {
    const peertubeLicence = VIDEO_LICENCES[key]
    if (peertubeLicence.toLowerCase() === licence.toLowerCase()) return parseInt(key, 10)
  }

  return undefined
}

function getCategory (categories: string[]) {
  if (!categories) return undefined

  const categoryString = categories[0]
  if (!categoryString || typeof categoryString !== 'string') return undefined

  if (categoryString === 'News & Politics') return 11

  for (const key of Object.keys(VIDEO_CATEGORIES)) {
    const category = VIDEO_CATEGORIES[key]
    if (categoryString.toLowerCase() === category.toLowerCase()) return parseInt(key, 10)
  }

  return undefined
}

function getLanguage (language: string) {
  return VIDEO_LANGUAGES[language] ? language : undefined
}

function wrapWithProxyOptions (options: string[]) {
  if (CONFIG.IMPORT.VIDEOS.HTTP.PROXY.ENABLED) {
    logger.debug('Using proxy for YoutubeDL')

    return [ '--proxy', CONFIG.IMPORT.VIDEOS.HTTP.PROXY.URL ].concat(options)
  }

  return options
}
