import { CONSTRAINTS_FIELDS, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '../initializers/constants'
import { logger } from './logger'
import { generateVideoImportTmpPath } from './utils'
import { join } from 'path'
import { peertubeTruncate, root } from './core-utils'
import { ensureDir, remove, writeFile } from 'fs-extra'
import * as request from 'request'
import { createWriteStream } from 'fs'
import { CONFIG } from '@server/initializers/config'

export type YoutubeDLInfo = {
  name?: string
  description?: string
  category?: number
  language?: string
  licence?: number
  nsfw?: boolean
  tags?: string[]
  thumbnailUrl?: string
  fileExt?: string
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
    args = wrapWithProxyOptions(args)

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

function downloadYoutubeDLVideo (url: string, extension: string, timeout: number) {
  const path = generateVideoImportTmpPath(url, extension)
  let timer

  logger.info('Importing youtubeDL video %s to %s', url, path)

  let options = [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path ]
  options = wrapWithProxyOptions(options)

  if (process.env.FFMPEG_PATH) {
    options = options.concat([ '--ffmpeg-location', process.env.FFMPEG_PATH ])
  }

  return new Promise<string>((res, rej) => {
    safeGetYoutubeDL()
      .then(youtubeDL => {
        youtubeDL.exec(url, options, processOptions, err => {
          clearTimeout(timer)

          if (err) {
            remove(path)
              .catch(err => logger.error('Cannot delete path on YoutubeDL error.', { err }))

            return rej(err)
          }

          return res(path)
        })

        timer = setTimeout(() => {
          const err = new Error('YoutubeDL download timeout.')

          remove(path)
            .finally(() => rej(err))
            .catch(err => {
              logger.error('Cannot remove %s in youtubeDL timeout.', path, { err })
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
  const url = 'https://yt-dl.org/downloads/latest/youtube-dl'

  await ensureDir(binDirectory)

  return new Promise(res => {
    request.get(url, { followRedirect: false }, (err, result) => {
      if (err) {
        logger.error('Cannot update youtube-dl.', { err })
        return res()
      }

      if (result.statusCode !== 302) {
        logger.error('youtube-dl update error: did not get redirect for the latest version link. Status %d', result.statusCode)
        return res()
      }

      const url = result.headers.location
      const downloadFile = request.get(url)
      const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(url)[1]

      downloadFile.on('response', result => {
        if (result.statusCode !== 200) {
          logger.error('Cannot update youtube-dl: new version response is not 200, it\'s %d.', result.statusCode)
          return res()
        }

        downloadFile.pipe(createWriteStream(bin, { mode: 493 }))
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
  downloadYoutubeDLVideo,
  getYoutubeDLSubs,
  getYoutubeDLInfo,
  safeGetYoutubeDL,
  buildOriginallyPublishedAt
}

// ---------------------------------------------------------------------------

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
    fileExt: obj.ext
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
