// FIXME: https://github.com/nodejs/node/pull/16853
require('tls').DEFAULT_ECDH_CURVE = 'auto'

import * as program from 'commander'
import { join } from 'path'
import * as youtubeDL from 'youtube-dl'
import { VideoPrivacy } from '../../shared/models/videos'
import { unlinkPromise } from '../helpers/core-utils'
import { doRequestAndSaveToFile } from '../helpers/requests'
import { CONSTRAINTS_FIELDS } from '../initializers'
import { getClient, getVideoCategories, login, searchVideo, uploadVideo } from '../tests/utils'
import { truncate } from 'lodash'

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-t, --target-url <targetUrl>', 'Video target URL')
  .option('-l, --language <languageCode>', 'Language code')
  .option('-v, --verbose', 'Verbose mode')
  .parse(process.argv)

if (
  !program['url'] ||
  !program['username'] ||
  !program['password'] ||
  !program['targetUrl']
) {
  console.error('All arguments are required.')
  process.exit(-1)
}

run().catch(err => console.error(err))

let accessToken: string
let client: { id: string, secret: string }

const user = {
  username: program['username'],
  password: program['password']
}

const processOptions = {
  cwd: __dirname,
  maxBuffer: Infinity
}

async function run () {
  const res = await getClient(program['url'])
  client = {
    id: res.body.client_id,
    secret: res.body.client_secret
  }

  const res2 = await login(program['url'], client, user)
  accessToken = res2.body.access_token

  const options = [ '-j', '--flat-playlist', '--playlist-reverse' ]
  youtubeDL.getInfo(program['targetUrl'], options, processOptions, async (err, info) => {
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
      await processVideo(info, program['language'])
    }

    // https://www.youtube.com/watch?v=2Upx39TBc1s
    console.log('I\'m finished!')
    process.exit(0)
  })
}

function processVideo (info: any, languageCode: number) {
  return new Promise(async res => {
    if (program['verbose']) console.log('Fetching object.', info)

    const videoInfo = await fetchObject(info)
    if (program['verbose']) console.log('Fetched object.', videoInfo)

    const result = await searchVideo(program['url'], videoInfo.title)

    console.log('############################################################\n')

    if (result.body.data.find(v => v.name === videoInfo.title)) {
      console.log('Video "%s" already exists, don\'t reupload it.\n', videoInfo.title)
      return res()
    }

    const path = join(__dirname, new Date().getTime() + '.mp4')

    console.log('Downloading video "%s"...', videoInfo.title)

    const options = [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path ]
    youtubeDL.exec(videoInfo.url, options, processOptions, async (err, output) => {
      if (err) return console.error(err)

      console.log(output.join('\n'))

      await uploadVideoOnPeerTube(normalizeObject(videoInfo), path, languageCode)

      return res()
    })
  })
}

async function uploadVideoOnPeerTube (videoInfo: any, videoPath: string, language?: number) {
  const category = await getCategory(videoInfo.categories)
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
    thumbnailfile = join(__dirname, 'thumbnail.jpg')

    await doRequestAndSaveToFile({
      method: 'GET',
      uri: videoInfo.thumbnail
    }, thumbnailfile)
  }

  const videoAttributes = {
    name: truncate(videoInfo.title, {
      'length': CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
      'separator': /,? +/,
      'omission': ' […]'
    }),
    category,
    licence,
    language,
    nsfw: isNSFW(videoInfo),
    commentsEnabled: true,
    description: videoInfo.description || undefined,
    support: undefined,
    tags,
    privacy: VideoPrivacy.PUBLIC,
    fixture: videoPath,
    thumbnailfile,
    previewfile: thumbnailfile
  }

  console.log('\nUploading on PeerTube video "%s".', videoAttributes.name)
  try {
    await uploadVideo(program['url'], accessToken, videoAttributes)
  } catch (err) {
    if (err.message.indexOf('401') !== -1) {
      console.log('Got 401 Unauthorized, token may have expired, renewing token and retry.')

      const res = await login(program['url'], client, user)
      accessToken = res.body.access_token

      await uploadVideo(program['url'], accessToken, videoAttributes)
    } else {
      console.log(err.message)
      process.exit(1)
    }
  }

  await unlinkPromise(videoPath)
  if (thumbnailfile) {
    await unlinkPromise(thumbnailfile)
  }

  console.log('Uploaded video "%s"!\n', videoAttributes.name)
}

async function getCategory (categories: string[]) {
  if (!categories) return undefined

  const categoryString = categories[0]

  if (categoryString === 'News & Politics') return 11

  const res = await getVideoCategories(program['url'])
  const categoriesServer = res.body

  for (const key of Object.keys(categoriesServer)) {
    const categoryServer = categoriesServer[key]
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
  if (info.age_limit && info.age_limit >= 16) return true

  return false
}
