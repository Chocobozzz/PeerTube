// FIXME: https://github.com/nodejs/node/pull/16853
require('tls').DEFAULT_ECDH_CURVE = 'auto'

import * as program from 'commander'
import { join } from 'path'
import { doRequestAndSaveToFile } from '../helpers/requests'
import { CONSTRAINTS_FIELDS } from '../initializers/constants'
import { getClient, getVideoCategories, login, searchVideoWithSort, uploadVideo } from '../../shared/extra-utils/index'
import { truncate } from 'lodash'
import * as prompt from 'prompt'
import { remove } from 'fs-extra'
import { sha256 } from '../helpers/core-utils'
import { buildOriginallyPublishedAt, safeGetYoutubeDL } from '../helpers/youtube-dl'
import { buildCommonVideoOptions, buildVideoAttributesFromCommander, getServerCredentials } from './cli'

type UserInfo = {
  username: string
  password: string
}

const processOptions = {
  cwd: __dirname,
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
  .option('-v, --verbose', 'Verbose mode')
  .parse(process.argv)

getServerCredentials(command)
  .then(({ url, username, password }) => {
    if (!program[ 'targetUrl' ]) {
      console.error('--targetUrl field is required.')

      process.exit(-1)
    }

    removeEndSlashes(url)
    removeEndSlashes(program[ 'targetUrl' ])

    const user = { username, password }

    run(url, user)
      .catch(err => {
        console.error(err)
        process.exit(-1)
      })
  })

async function run (url: string, user: UserInfo) {
  if (!user.password) {
    user.password = await promptPassword()
  }

  const youtubeDL = await safeGetYoutubeDL()

  const options = [ '-j', '--flat-playlist', '--playlist-reverse' ]
  youtubeDL.getInfo(program[ 'targetUrl' ], options, processOptions, async (err, info) => {
    if (err) {
      console.log(err.message)
      process.exit(1)
    }

    let infoArray: any[]

    // Normalize utf8 fields
    if (Array.isArray(info) === true) {
      infoArray = info.map(i => normalizeObject(i))
    } else {
      infoArray = [ normalizeObject(info) ]
    }
    console.log('Will download and upload %d videos.\n', infoArray.length)

    for (const info of infoArray) {
      await processVideo({
        cwd: processOptions.cwd,
        url,
        user,
        youtubeInfo: info
      })
    }

    console.log('Video/s for user %s imported: %s', program[ 'username' ], program[ 'targetUrl' ])
    process.exit(0)
  })
}

function processVideo (parameters: {
  cwd: string,
  url: string,
  user: { username: string, password: string },
  youtubeInfo: any
}) {
  const { youtubeInfo, cwd, url, user } = parameters

  return new Promise(async res => {
    if (program[ 'verbose' ]) console.log('Fetching object.', youtubeInfo)

    const videoInfo = await fetchObject(youtubeInfo)
    if (program[ 'verbose' ]) console.log('Fetched object.', videoInfo)

    if (program[ 'since' ]) {
      if (buildOriginallyPublishedAt(videoInfo).getTime() < program[ 'since' ].getTime()) {
        console.log('Video "%s" has been published before "%s", don\'t upload it.\n',
          videoInfo.title, formatDate(program[ 'since' ]));
        return res();
      }
    }
    if (program[ 'until' ]) {
      if (buildOriginallyPublishedAt(videoInfo).getTime() > program[ 'until' ].getTime()) {
        console.log('Video "%s" has been published after "%s", don\'t upload it.\n',
          videoInfo.title, formatDate(program[ 'until' ]));
        return res();
      }
    }

    const result = await searchVideoWithSort(url, videoInfo.title, '-match')

    console.log('############################################################\n')

    if (result.body.data.find(v => v.name === videoInfo.title)) {
      console.log('Video "%s" already exists, don\'t reupload it.\n', videoInfo.title)
      return res()
    }

    const path = join(cwd, sha256(videoInfo.url) + '.mp4')

    console.log('Downloading video "%s"...', videoInfo.title)

    const options = [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path ]
    try {
      const youtubeDL = await safeGetYoutubeDL()
      youtubeDL.exec(videoInfo.url, options, processOptions, async (err, output) => {
        if (err) {
          console.error(err)
          return res()
        }

        console.log(output.join('\n'))
        await uploadVideoOnPeerTube({
          cwd,
          url,
          user,
          videoInfo: normalizeObject(videoInfo),
          videoPath: path
        })
        return res()
      })
    } catch (err) {
      console.log(err.message)
      return res()
    }
  })
}

async function uploadVideoOnPeerTube (parameters: {
  videoInfo: any,
  videoPath: string,
  cwd: string,
  url: string,
  user: { username: string; password: string }
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
      'length': CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
      'separator': /,? +/,
      'omission': ' […]'
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

  console.log('\nUploading on PeerTube video "%s".', videoAttributes.name)

  let accessToken = await getAccessTokenOrDie(url, user)

  try {
    await uploadVideo(url, accessToken, videoAttributes)
  } catch (err) {
    if (err.message.indexOf('401') !== -1) {
      console.log('Got 401 Unauthorized, token may have expired, renewing token and retry.')

      accessToken = await getAccessTokenOrDie(url, user)

      await uploadVideo(url, accessToken, videoAttributes)
    } else {
      console.log(err.message)
      process.exit(1)
    }
  }

  await remove(videoPath)
  if (thumbnailfile) await remove(thumbnailfile)

  console.log('Uploaded video "%s"!\n', videoAttributes.name)
}

/* ---------------------------------------------------------- */

async function getCategory (categories: string[], url: string) {
  if (!categories) return undefined

  const categoryString = categories[ 0 ]

  if (categoryString === 'News & Politics') return 11

  const res = await getVideoCategories(url)
  const categoriesServer = res.body

  for (const key of Object.keys(categoriesServer)) {
    const categoryServer = categoriesServer[ key ]
    if (categoryString.toLowerCase() === categoryServer.toLowerCase()) return parseInt(key, 10)
  }

  return undefined
}

function getLicence (licence: string) {
  if (!licence) return undefined

  if (licence.indexOf('Creative Commons Attribution licence') !== -1) return 1

  return undefined
}

function normalizeObject (obj: any) {
  const newObj: any = {}

  for (const key of Object.keys(obj)) {
    // Deprecated key
    if (key === 'resolution') continue

    const value = obj[ key ]

    if (typeof value === 'string') {
      newObj[ key ] = value.normalize()
    } else {
      newObj[ key ] = value
    }
  }

  return newObj
}

function fetchObject (info: any) {
  const url = buildUrl(info)

  return new Promise<any>(async (res, rej) => {
    const youtubeDL = await safeGetYoutubeDL()
    youtubeDL.getInfo(url, undefined, processOptions, async (err, videoInfo) => {
      if (err) return rej(err)

      const videoInfoWithUrl = Object.assign(videoInfo, { url })
      return res(normalizeObject(videoInfoWithUrl))
    })
  })
}

function buildUrl (info: any) {
  const webpageUrl = info.webpage_url as string
  if (webpageUrl && webpageUrl.match(/^https?:\/\//)) return webpageUrl

  const url = info.url as string
  if (url && url.match(/^https?:\/\//)) return url

  // It seems youtube-dl does not return the video url
  return 'https://www.youtube.com/watch?v=' + info.id
}

function isNSFW (info: any) {
  return info.age_limit && info.age_limit >= 16
}

function removeEndSlashes (url: string) {
  while (url.endsWith('/')) {
    url.slice(0, -1)
  }
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
    console.error('Cannot authenticate. Please check your username/password.')
    process.exit(-1)
  }
}

function parseDate (dateAsStr: string): Date {
  if (!/\d{4}-\d{2}-\d{2}/.test(dateAsStr)) {
    console.error(`Invalid date passed: ${dateAsStr}. Expected format: YYYY-MM-DD. See help for usage.`);
    process.exit(-1);
  }
  const date = new Date(dateAsStr);
  if (isNaN(date.getTime())) {
    console.error(`Invalid date passed: ${dateAsStr}. See help for usage.`);
    process.exit(-1);
  }
  return date;
}

function formatDate (date: Date): string {
  return date.toISOString().split('T')[0];
}
