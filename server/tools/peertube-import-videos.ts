import { program } from 'commander'
import { accessSync, constants } from 'fs'
import { remove } from 'fs-extra'
import { join } from 'path'
import { YoutubeDLCLI, YoutubeDLInfo, YoutubeDLInfoBuilder } from '@server/helpers/youtube-dl'
import { wait } from '@shared/core-utils'
import { sha256 } from '@shared/extra-utils'
import { doRequestAndSaveToFile } from '../helpers/requests'
import {
  assignToken,
  buildCommonVideoOptions,
  buildServer,
  buildVideoAttributesFromCommander,
  getLogger,
  getServerCredentials
} from './shared'

import prompt = require('prompt')

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
  .usage('[global options] [ -- youtube-dl options]')
  .parse(process.argv)

const options = command.opts()

const log = getLogger(options.verbose)

getServerCredentials(command)
  .then(({ url, username, password }) => {
    if (!options.targetUrl) {
      exitError('--target-url field is required.')
    }

    try {
      accessSync(options.tmpdir, constants.R_OK | constants.W_OK)
    } catch (e) {
      exitError('--tmpdir %s: directory does not exist or is not accessible', options.tmpdir)
    }

    url = normalizeTargetUrl(url)
    options.targetUrl = normalizeTargetUrl(options.targetUrl)

    run(url, username, password)
      .catch(err => exitError(err))
  })
  .catch(err => console.error(err))

async function run (url: string, username: string, password: string) {
  if (!password) password = await promptPassword()

  const youtubeDLBinary = await YoutubeDLCLI.safeGet()

  let info = await getYoutubeDLInfo(youtubeDLBinary, options.targetUrl, command.args)

  if (!Array.isArray(info)) info = [ info ]

  // Try to fix youtube channels upload
  const uploadsObject = info.find(i => !i.ie_key && !i.duration && i.title === 'Uploads')

  if (uploadsObject) {
    console.log('Fixing URL to %s.', uploadsObject.url)

    info = await getYoutubeDLInfo(youtubeDLBinary, uploadsObject.url, command.args)
  }

  let infoArray: any[]

  infoArray = [].concat(info)
  if (options.first) {
    infoArray = infoArray.slice(0, options.first)
  } else if (options.last) {
    infoArray = infoArray.slice(-options.last)
  }

  log.info('Will download and upload %d videos.\n', infoArray.length)

  let skipInterval = true
  for (const [ index, info ] of infoArray.entries()) {
    try {
      if (index > 0 && options.waitInterval && !skipInterval) {
        log.info('Wait for %d seconds before continuing.', options.waitInterval / 1000)
        await wait(options.waitInterval)
      }

      skipInterval = await processVideo({
        cwd: options.tmpdir,
        url,
        username,
        password,
        youtubeInfo: info
      })
    } catch (err) {
      console.error('Cannot process video.', { info, url, err })
    }
  }

  log.info('Video/s for user %s imported: %s', username, options.targetUrl)
  process.exit(0)
}

async function processVideo (parameters: {
  cwd: string
  url: string
  username: string
  password: string
  youtubeInfo: any
}) {
  const { youtubeInfo, cwd, url, username, password } = parameters

  log.debug('Fetching object.', youtubeInfo)

  const videoInfo = await fetchObject(youtubeInfo)
  log.debug('Fetched object.', videoInfo)

  if (
    options.since &&
    videoInfo.originallyPublishedAtWithoutTime &&
    videoInfo.originallyPublishedAtWithoutTime.getTime() < options.since.getTime()
  ) {
    log.info('Video "%s" has been published before "%s", don\'t upload it.\n', videoInfo.name, formatDate(options.since))
    return true
  }

  if (
    options.until &&
    videoInfo.originallyPublishedAtWithoutTime &&
    videoInfo.originallyPublishedAtWithoutTime.getTime() > options.until.getTime()
  ) {
    log.info('Video "%s" has been published after "%s", don\'t upload it.\n', videoInfo.name, formatDate(options.until))
    return true
  }

  const server = buildServer(url)
  const { data } = await server.search.advancedVideoSearch({
    search: {
      search: videoInfo.name,
      sort: '-match',
      searchTarget: 'local'
    }
  })

  log.info('############################################################\n')

  if (data.find(v => v.name === videoInfo.name)) {
    log.info('Video "%s" already exists, don\'t reupload it.\n', videoInfo.name)
    return true
  }

  const path = join(cwd, sha256(videoInfo.url) + '.mp4')

  log.info('Downloading video "%s"...', videoInfo.name)

  try {
    const youtubeDLBinary = await YoutubeDLCLI.safeGet()
    const output = await youtubeDLBinary.download({
      url: videoInfo.url,
      format: YoutubeDLCLI.getYoutubeDLVideoFormat([], false),
      output: path,
      additionalYoutubeDLArgs: command.args,
      processOptions
    })

    log.info(output.join('\n'))
    await uploadVideoOnPeerTube({
      cwd,
      url,
      username,
      password,
      videoInfo,
      videoPath: path
    })
  } catch (err) {
    log.error(err.message)
  }

  return false
}

async function uploadVideoOnPeerTube (parameters: {
  videoInfo: YoutubeDLInfo
  videoPath: string
  cwd: string
  url: string
  username: string
  password: string
}) {
  const { videoInfo, videoPath, cwd, url, username, password } = parameters

  const server = buildServer(url)
  await assignToken(server, username, password)

  let thumbnailfile: string
  if (videoInfo.thumbnailUrl) {
    thumbnailfile = join(cwd, sha256(videoInfo.thumbnailUrl) + '.jpg')

    await doRequestAndSaveToFile(videoInfo.thumbnailUrl, thumbnailfile)
  }

  const baseAttributes = await buildVideoAttributesFromCommander(server, program, videoInfo)

  const attributes = {
    ...baseAttributes,

    originallyPublishedAtWithoutTime: videoInfo.originallyPublishedAtWithoutTime
      ? videoInfo.originallyPublishedAtWithoutTime.toISOString()
      : null,

    thumbnailfile,
    previewfile: thumbnailfile,
    fixture: videoPath
  }

  log.info('\nUploading on PeerTube video "%s".', attributes.name)

  try {
    await server.videos.upload({ attributes })
  } catch (err) {
    if (err.message.indexOf('401') !== -1) {
      log.info('Got 401 Unauthorized, token may have expired, renewing token and retry.')

      server.accessToken = await server.login.getAccessToken(username, password)

      await server.videos.upload({ attributes })
    } else {
      exitError(err.message)
    }
  }

  await remove(videoPath)
  if (thumbnailfile) await remove(thumbnailfile)

  log.info('Uploaded video "%s"!\n', attributes.name)
}

/* ---------------------------------------------------------- */

async function fetchObject (info: any) {
  const url = buildUrl(info)

  const youtubeDLCLI = await YoutubeDLCLI.safeGet()
  const result = await youtubeDLCLI.getInfo({
    url,
    format: YoutubeDLCLI.getYoutubeDLVideoFormat([], false),
    processOptions
  })

  const builder = new YoutubeDLInfoBuilder(result)

  const videoInfo = builder.getInfo()

  return { ...videoInfo, url }
}

function buildUrl (info: any) {
  const webpageUrl = info.webpage_url as string
  if (webpageUrl?.match(/^https?:\/\//)) return webpageUrl

  const url = info.url as string
  if (url?.match(/^https?:\/\//)) return url

  // It seems youtube-dl does not return the video url
  return 'https://www.youtube.com/watch?v=' + info.id
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

function getYoutubeDLInfo (youtubeDLCLI: YoutubeDLCLI, url: string, args: string[]) {
  return youtubeDLCLI.getInfo({
    url,
    format: YoutubeDLCLI.getYoutubeDLVideoFormat([], false),
    additionalYoutubeDLArgs: [ '-j', '--flat-playlist', '--playlist-reverse', ...args ],
    processOptions
  })
}
