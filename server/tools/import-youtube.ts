import * as program from 'commander'
import { join } from 'path'
import * as youtubeDL from 'youtube-dl'
import { VideoPrivacy } from '../../shared/models/videos'
import { unlinkPromise } from '../helpers/core-utils'
import { doRequestAndSaveToFile } from '../helpers/requests'
import { CONSTRAINTS_FIELDS } from '../initializers'
import { getClient, getVideoCategories, login, searchVideo, uploadVideo } from '../tests/utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-y, --youtube-url <youtubeUrl>', 'Youtube URL')
  .option('-l, --language <languageCode>', 'Language code')
  .parse(process.argv)

if (
  !program['url'] ||
  !program['username'] ||
  !program['password'] ||
  !program['youtubeUrl']
) {
  console.error('All arguments are required.')
  process.exit(-1)
}

run().catch(err => console.error(err))

let accessToken: string
const processOptions = {
  cwd: __dirname,
  maxBuffer: Infinity
}

async function run () {
  const res = await getClient(program['url'])
  const client = {
    id: res.body.client_id,
    secret: res.body.client_secret
  }

  const user = {
    username: program['username'],
    password: program['password']
  }

  const res2 = await login(program['url'], client, user)
  accessToken = res2.body.access_token

  const options = [ '-j', '--flat-playlist', '--playlist-reverse' ]
  youtubeDL.getInfo(program['youtubeUrl'], options, processOptions, async (err, info) => {
    if (err) throw err

    let infoArray: any[]

    // Normalize utf8 fields
    if (Array.isArray(info) === true) {
      infoArray = info.map(i => normalizeObject(i))
    } else {
      infoArray = [ normalizeObject(info) ]
    }

    const videos = infoArray.map(i => {
      return { url: 'https://www.youtube.com/watch?v=' + i.id, name: i.title }
    })

    console.log('Will download and upload %d videos.\n', videos.length)

    for (const video of videos) {
      await processVideo(video, program['language'])
    }

    console.log('I\'m finished!')
    process.exit(0)
  })
}

function processVideo (video: { name: string, url: string }, languageCode: number) {
  return new Promise(async res => {
    const result = await searchVideo(program['url'], video.name)

    console.log('############################################################\n')

    if (result.body.data.find(v => v.name === video.name)) {
      console.log('Video "%s" already exists, don\'t reupload it.\n', video.name)
      return res()
    }

    const path = join(__dirname, new Date().getTime() + '.mp4')

    console.log('Downloading video "%s"...', video.name)

    const options = [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]', '-o', path ]
    youtubeDL.exec(video.url, options, processOptions, async (err, output) => {
      if (err) return console.error(err)

      console.log(output.join('\n'))

      youtubeDL.getInfo(video.url, undefined, processOptions, async (err, videoInfo) => {
        if (err) return console.error(err)

        await uploadVideoOnPeerTube(normalizeObject(videoInfo), path, languageCode)

        return res()
      })
    })
  })
}

async function uploadVideoOnPeerTube (videoInfo: any, videoPath: string, language?: number) {
  const category = await getCategory(videoInfo.categories)
  const licence = getLicence(videoInfo.license)
  let tags = []
  if (Array.isArray(videoInfo.tags)) {
    tags = videoInfo.tags
      .filter(t => t.length < CONSTRAINTS_FIELDS.VIDEOS.TAG.max)
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
    name: videoInfo.title,
    category,
    licence,
    language,
    nsfw: false,
    commentsEnabled: true,
    description: videoInfo.description,
    tags,
    privacy: VideoPrivacy.PUBLIC,
    fixture: videoPath,
    thumbnailfile,
    previewfile: thumbnailfile
  }

  console.log('\nUploading on PeerTube video "%s".', videoAttributes.name)
  await uploadVideo(program['url'], accessToken, videoAttributes)

  await unlinkPromise(videoPath)
  if (thumbnailfile) {
    await unlinkPromise(thumbnailfile)
  }

  console.log('Uploaded video "%s"!\n', videoAttributes.name)
}

async function getCategory (categories: string[]) {
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
