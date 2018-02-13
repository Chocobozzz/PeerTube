import * as program from 'commander'
import { join } from 'path'
import * as youtubeDL from 'youtube-dl'
import { VideoPrivacy } from '../../shared/models/videos'
import { unlinkPromise } from '../helpers/core-utils'
import { getClient, getVideoCategories, login, searchVideo, uploadVideo } from '../tests/utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-y, --youtube-url <youtubeUrl>', 'Youtube URL')
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

    // Normalize utf8 fields
    info = info.map(i => normalizeObject(i))

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

function processVideo (video: { name: string, url: string }) {
  return new Promise(async res => {
    const result = await searchVideo(program['url'], video.name)

    console.log('############################################################\n')

    if (result.body.total !== 0) {
      console.log('Video "%s" already exists, don\'t reupload it.\n', video.name)
      return res()
    }

    const path = join(__dirname, new Date().getTime() + '.mp4')

    console.log('Downloading video "%s"...', video.name)

    youtubeDL.exec(video.url, [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]', '-o', path ], {}, async (err, output) => {
      if (err) return console.error(err)

      console.log(output.join('\n'))

      youtubeDL.getInfo(video.url, async (err, videoInfo) => {
        if (err) return console.error(err)

        await uploadVideoOnPeerTube(normalizeObject(videoInfo), path)

        return res()
      })
    })
  })
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
