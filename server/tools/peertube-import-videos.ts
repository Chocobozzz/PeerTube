import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import { accessSync, constants } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

import * as program from 'commander'
import { remove } from 'fs-extra'
import { truncate } from 'lodash'
import * as prompt from 'prompt'

import { doRequestAndSaveToFile } from '../helpers/requests'
import { CONSTRAINTS_FIELDS } from '../initializers/constants'
import { getClient, getVideoCategories, login, searchVideoWithSort, uploadVideo } from '../../shared/extra-utils/index'
import { sha256 } from '../helpers/core-utils'
import { buildOriginallyPublishedAt, getYoutubeDLVideoFormat, safeGetYoutubeDL } from '../helpers/youtube-dl'
import { buildCommonVideoOptions, buildVideoAttributesFromCommander, getLogger, getServerCredentials } from './cli'

type UserInfo = {
  username: string
  password: string
}

const processOptions = {
  maxBuffer: Infinity
}

let command = program
  .name('import-videos')

command = buildCommonVideoOptions(command)

command
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('--target-url <targetUrl>', 'Video target URL')
  .option('--since <since>', 'Publication date (inclusive) since which the videos can be imported (YYYY-MM-DD)', parseDate)
  .option('--until <until>', 'Publication date (inclusive) until which the videos can be imported (YYYY-MM-DD)', parseDate)
  .option('--first <first>', 'Process first n elements of returned playlist')
  .option('--last <last>', 'Process last n elements of returned playlist')
  .option('--wait-interval <waitInterval>', 'Duration between two video imports (in seconds)', convertIntoMs)
  .option('-T, --tmpdir <tmpdir>', 'Working directory', __dirname)
  .usage("[global options] [ -- youtube-dl options]")
  .parse(process.argv)

const log = getLogger(program['verbose'])

getServerCredentials(command)
  .then(({ url, username, password }) => {
    if (!program['targetUrl']) {
      exitError('--target-url field is required.')
    }

    try {
      accessSync(program['tmpdir'], constants.R_OK | constants.W_OK)
    } catch (e) {
      exitError('--tmpdir %s: directory does not exist or is not accessible', program['tmpdir'])
    }

    url = normalizeTargetUrl(url)
    program['targetUrl'] = normalizeTargetUrl(program['targetUrl'])

    const user = { username, password }

    run(url, user)
      .catch(err => exitError(err))
  })
  .catch(err => console.error(err))

async function run (url: string, user: UserInfo) {
  if (!user.password) {
    user.password = await promptPassword()
  }

  const youtubeDL = await safeGetYoutubeDL()

  let info = await getYoutubeDLInfo(youtubeDL, program['targetUrl'], command.args)

  if (!Array.isArray(info)) info = [ info ]

  // Try to fix youtube channels upload
  const uploadsObject = info.find(i => !i.ie_key && !i.duration && i.title === 'Uploads')

  if (uploadsObject) {
    console.log('Fixing URL to %s.', uploadsObject.url)

    info = await getYoutubeDLInfo(youtubeDL, uploadsObject.url, command.args)
  }

  let infoArray: any[]

  infoArray = [].concat(info)
  if (program['first']) {
    infoArray = infoArray.slice(0, program['first'])
  } else if (program['last']) {
    infoArray = infoArray.slice(-program['last'])
  }
  // Normalize utf8 fields
  infoArray = infoArray.map(i => normalizeObject(i))

  log.info('Will download and upload %d videos.\n', infoArray.length)

  for (const [ index, info ] of infoArray.entries()) {
    try {
      if (index > 0 && program['waitInterval']) {
        log.info("Wait for %d seconds before continuing.", program['waitInterval'] / 1000)
        await new Promise(res => setTimeout(res, program['waitInterval']))
      }
      await processVideo({
        cwd: program['tmpdir'],
        url,
        user,
        youtubeInfo: info
      })
    } catch (err) {
      console.error('Cannot process video.', { info, url, err })
    }
  }

  log.info('Video/s for user %s imported: %s', user.username, program['targetUrl'])
  process.exit(0)
}

async function processVideo (parameters: {
  cwd: string
  url: string
  user: { username: string, password: string }
  youtubeInfo: any
}) {
  const { youtubeInfo, cwd, url, user } = parameters

  log.debug('Fetching object.', youtubeInfo)

  const videoInfo = await fetchObject(youtubeInfo)
  log.debug('Fetched object.', videoInfo)

  const originallyPublishedAt = buildOriginallyPublishedAt(videoInfo)
  if (program['since'] && originallyPublishedAt && originallyPublishedAt.getTime() < program['since'].getTime()) {
    log.info('Video "%s" has been published before "%s", don\'t upload it.\n',
      videoInfo.title, formatDate(program['since']))
    return
  }
  if (program['until'] && originallyPublishedAt && originallyPublishedAt.getTime() > program['until'].getTime()) {
    log.info('Video "%s" has been published after "%s", don\'t upload it.\n',
      videoInfo.title, formatDate(program['until']))
    return
  }

  const result = await searchVideoWithSort(url, videoInfo.title, '-match')

  log.info('############################################################\n')

  if (result.body.data.find(v => v.name === videoInfo.title)) {
    log.info('Video "%s" already exists, don\'t reupload it.\n', videoInfo.title)
    return
  }

  const path = join(cwd, sha256(videoInfo.url) + '.mp4')

  log.info('Downloading video "%s"...', videoInfo.title)

  const options = [ '-f', getYoutubeDLVideoFormat(), ...command.args, '-o', path ]
  try {
    const youtubeDL = await safeGetYoutubeDL()
    const youtubeDLExec = promisify(youtubeDL.exec).bind(youtubeDL)
    const output = await youtubeDLExec(videoInfo.url, options, processOptions)
    log.info(output.join('\n'))
    await uploadVideoOnPeerTube({
      cwd,
      url,
      user,
      videoInfo: normalizeObject(videoInfo),
      videoPath: path
    })
  } catch (err) {
    log.error(err.message)
  }
}

async function uploadVideoOnPeerTube (parameters: {
  videoInfo: any
  videoPath: string
  cwd: string
  url: string
  user: { username: string, password: string }
}) {
  const { videoInfo, videoPath, cwd, url, user } = parameters

  const category = await getCategory(videoInfo.categories, url)
  const licence = getLicence(videoInfo.license)
  let tags = []
  if (Array.isArray(videoInfo.tags)) {
    tags = videoInfo.tags
                    .filter(t => t.length < CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
                    .map(t => t.normalize())
                    .slice(0, 5)
  }

  let thumbnailfile
  if (videoInfo.thumbnail) {
    thumbnailfile = join(cwd, sha256(videoInfo.thumbnail) + '.jpg')

    await doRequestAndSaveToFile({
      method: 'GET',
      uri: videoInfo.thumbnail
    }, thumbnailfile)
  }

  const originallyPublishedAt = buildOriginallyPublishedAt(videoInfo)

  const defaultAttributes = {
    name: truncate(videoInfo.title, {
      length: CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
      separator: /,? +/,
      omission: ' […]'
    }),
    category,
    licence,
    nsfw: isNSFW(videoInfo),
    description: videoInfo.description,
    tags
  }

  const videoAttributes = await buildVideoAttributesFromCommander(url, program, defaultAttributes)

  Object.assign(videoAttributes, {
    originallyPublishedAt: originallyPublishedAt ? originallyPublishedAt.toISOString() : null,
    thumbnailfile,
    previewfile: thumbnailfile,
    fixture: videoPath
  })

  log.info('\nUploading on PeerTube video "%s".', videoAttributes.name)

  let accessToken = await getAccessTokenOrDie(url, user)

  try {
    await uploadVideo(url, accessToken, videoAttributes)
  } catch (err) {
    if (err.message.indexOf('401') !== -1) {
      log.info('Got 401 Unauthorized, token may have expired, renewing token and retry.')

      accessToken = await getAccessTokenOrDie(url, user)

      await uploadVideo(url, accessToken, videoAttributes)
    } else {
      exitError(err.message)
    }
  }

  await remove(videoPath)
  if (thumbnailfile) await remove(thumbnailfile)

  log.warn('Uploaded video "%s"!\n', videoAttributes.name)
}

/* ---------------------------------------------------------- */

async function getCategory (categories: string[], url: string) {
  if (!categories) return undefined

  const categoryString = categories[0]

  if (categoryString === 'News & Politics') return 11

  const res = await getVideoCategories(url)
  const categoriesServer = res.body

  for (const key of Object.keys(categoriesServer)) {
    const categoryServer = categoriesServer[key]
    if (categoryString.toLowerCase() === categoryServer.toLowerCase()) return parseInt(key, 10)
  }

  return undefined
}

function getLicence (licence: string) {
  if (!licence) return undefined

  if (licence.includes('Creative Commons Attribution licence')) return 1

  return undefined
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

function fetchObject (info: any) {
  const url = buildUrl(info)

  return new Promise<any>(async (res, rej) => {
    const youtubeDL = await safeGetYoutubeDL()
    youtubeDL.getInfo(url, undefined, processOptions, (err, videoInfo) => {
      if (err) return rej(err)

      const videoInfoWithUrl = Object.assign(videoInfo, { url })
      return res(normalizeObject(videoInfoWithUrl))
    })
  })
}

function buildUrl (info: any) {
  const webpageUrl = info.webpage_url as string
  if (webpageUrl?.match(/^https?:\/\//)) return webpageUrl

  const url = info.url as string
  if (url?.match(/^https?:\/\//)) return url

  // It seems youtube-dl does not return the video url
  return 'https://www.youtube.com/watch?v=' + info.id
}

function isNSFW (info: any) {
  return info.age_limit && info.age_limit >= 16
}

function normalizeTargetUrl (url: string) {
  let normalizedUrl = url.replace(/\/+$/, '')

  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  return normalizedUrl
}

async function promptPassword () {
  return new Promise<string>((res, rej) => {
    prompt.start()
    const schema = {
      properties: {
        password: {
          hidden: true,
          required: true
        }
      }
    }
    prompt.get(schema, function (err, result) {
      if (err) {
        return rej(err)
      }
      return res(result.password)
    })
  })
}

async function getAccessTokenOrDie (url: string, user: UserInfo) {
  const resClient = await getClient(url)
  const client = {
    id: resClient.body.client_id,
    secret: resClient.body.client_secret
  }

  try {
    const res = await login(url, client, user)
    return res.body.access_token
  } catch (err) {
    exitError('Cannot authenticate. Please check your username/password.')
  }
}

function parseDate (dateAsStr: string): Date {
  if (!/\d{4}-\d{2}-\d{2}/.test(dateAsStr)) {
    exitError(`Invalid date passed: ${dateAsStr}. Expected format: YYYY-MM-DD. See help for usage.`)
  }
  const date = new Date(dateAsStr)
  date.setHours(0, 0, 0)
  if (isNaN(date.getTime())) {
    exitError(`Invalid date passed: ${dateAsStr}. See help for usage.`)
  }
  return date
}

function formatDate (date: Date): string {
  return date.toISOString().split('T')[0]
}

function convertIntoMs (secondsAsStr: string): number {
  const seconds = parseInt(secondsAsStr, 10)
  if (seconds <= 0) {
    exitError(`Invalid duration passed: ${seconds}. Expected duration to be strictly positive and in seconds`)
  }
  return Math.round(seconds * 1000)
}

function exitError (message: string, ...meta: any[]) {
  // use console.error instead of log.error here
  console.error(message, ...meta)
  process.exit(-1)
}

function getYoutubeDLInfo (youtubeDL: any, url: string, args: string[]) {
  return new Promise<any>((res, rej) => {
    const options = [ '-j', '--flat-playlist', '--playlist-reverse', ...args ]

    youtubeDL.getInfo(url, options, processOptions, async (err, info) => {
      if (err) return rej(err)

      return res(info)
    })
  })
}
