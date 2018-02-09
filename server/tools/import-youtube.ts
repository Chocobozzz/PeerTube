import * as program from 'commander'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { cursorTo } from 'readline'
import * as youtubeDL from 'youtube-dl'
import { VideoPrivacy } from '../../shared/models/videos'
import { unlinkPromise } from '../helpers/core-utils'
import { getClient, getVideoCategories, login, searchVideo, uploadVideo } from '../tests/utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-y, --youtube-url <directory>', 'Youtube URL')
  .parse(process.argv)

if (
  !program['url'] ||
  !program['username'] ||
  !program['password'] ||
  !program['youtubeUrl']
) {
  throw new Error('All arguments are required.')
}

run().catch(err => console.error(err))

let accessToken: string

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

  youtubeDL.getInfo(program['youtubeUrl'], [ '-j', '--flat-playlist' ], async (err, info) => {
    if (err) throw err

    const videos = info.map(i => {
      return { url: 'https://www.youtube.com/watch?v=' + i.id, name: i.title }
    })

    console.log('Will download and upload %d videos.\n', videos.length)

    for (const video of videos) {
      await processVideo(video)
    }

    console.log('I\'m finished!')
    process.exit(0)
  })
}

function processVideo (videoUrlName: { name: string, url: string }) {
  return new Promise(async res => {
    const result = await searchVideo(program['url'], videoUrlName.name)
    if (result.body.total !== 0) {
      console.log('Video "%s" already exist, don\'t reupload it.\n', videoUrlName.name)
      return res()
    }

    const video = youtubeDL(videoUrlName.url)
    let videoInfo
    let videoPath: string

    video.on('error', err => console.error(err))

    let size = 0
    video.on('info', info => {
      videoInfo = info
      size = info.size

      videoPath = join(__dirname, size + '.mp4')
      console.log('Creating "%s" of video "%s".', videoPath, videoInfo.title)

      video.pipe(createWriteStream(videoPath))
    })

    let pos = 0
    video.on('data', chunk => {
      pos += chunk.length
      // `size` should not be 0 here.
      if (size) {
        const percent = (pos / size * 100).toFixed(2)
        writeWaitingPercent(percent)
      }
    })

    video.on('end', async () => {
      await uploadVideoOnPeerTube(videoInfo, videoPath)

      return res()
    })
  })
}

function writeWaitingPercent (p: string) {
  cursorTo(process.stdout, 0)
  process.stdout.write(`waiting ... ${p}%`)
}

async function uploadVideoOnPeerTube (videoInfo: any, videoPath: string) {
  const category = await getCategory(videoInfo.categories)
  const licence = getLicence(videoInfo.license)
  const language = 13

  const videoAttributes = {
    name: videoInfo.title,
    category,
    licence,
    language,
    nsfw: false,
    commentsEnabled: true,
    description: videoInfo.description,
    tags: videoInfo.tags.slice(0, 5),
    privacy: VideoPrivacy.PUBLIC,
    fixture: videoPath
  }

  console.log('\nUploading on PeerTube video "%s".', videoAttributes.name)
  await uploadVideo(program['url'], accessToken, videoAttributes)
  await unlinkPromise(videoPath)
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
