import { VideoRateType } from '../../../shared'
import {
  addVideoChannel,
  createUser,
  flushTests,
  getVideosList,
  killallServers,
  rateVideo,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../utils'
import * as Bluebird from 'bluebird'

start()
  .catch(err => console.error(err))

// ----------------------------------------------------------------------------

async function start () {
  await flushTests()

  console.log('Flushed tests.')

  const server = await runServer(6)

  process.on('exit', async () => {
    killallServers([ server ])
    return
  })
  process.on('SIGINT', goodbye)
  process.on('SIGTERM', goodbye)

  await setAccessTokensToServers([ server ])

  console.log('Servers ran.')

  // Forever
  const fakeTab = Array.from(Array(1000000).keys())
  const funs = [
    uploadCustom
    // uploadCustom,
    // uploadCustom,
    // uploadCustom,
    // likeCustom,
    // createUserCustom,
    // createCustomChannel
  ]
  const promises = []

  for (const fun of funs) {
    promises.push(
      Bluebird.map(fakeTab, () => {
        return fun(server).catch(err => console.error(err))
      }, { concurrency: 3 })
    )
  }

  await Promise.all(promises)
}

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function createCustomChannel (server: ServerInfo) {
  const videoChannel = {
    name: Date.now().toString(),
    displayName: Date.now().toString(),
    description: Date.now().toString()
  }

  return addVideoChannel(server.url, server.accessToken, videoChannel)
}

function createUserCustom (server: ServerInfo) {
  const username = Date.now().toString() + getRandomInt(0, 100000)
  console.log('Creating user %s.', username)

  return createUser(server.url, server.accessToken, username, 'coucou')
}

function uploadCustom (server: ServerInfo) {
  console.log('Uploading video.')

  const videoAttributes = {
    name: Date.now() + ' name',
    category: 4,
    nsfw: false,
    licence: 2,
    language: 'en',
    description: Date.now() + ' description',
    tags: [ Date.now().toString().substring(0, 5) + 't1', Date.now().toString().substring(0, 5) + 't2' ],
    fixture: 'video_short.mp4'
  }

  return uploadVideo(server.url, server.accessToken, videoAttributes)
}

function likeCustom (server: ServerInfo) {
  return rateCustom(server, 'like')
}

function dislikeCustom (server: ServerInfo) {
  return rateCustom(server, 'dislike')
}

async function rateCustom (server: ServerInfo, rating: VideoRateType) {
  const res = await getVideosList(server.url)

  const videos = res.body.data
  if (videos.length === 0) return undefined

  const videoToRate = videos[getRandomInt(0, videos.length)]

  console.log('Rating (%s) video.', rating)
  return rateVideo(server.url, server.accessToken, videoToRate.id, rating)
}

function goodbye () {
  return process.exit(-1)
}
