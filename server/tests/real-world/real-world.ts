// /!\ Before imports /!\
process.env.NODE_ENV = 'test'

import * as program from 'commander'
import { Video, VideoFile, VideoRateType } from '../../../shared'
import { JobState } from '../../../shared/models'
import {
  flushAndRunMultipleServers,
  flushTests, follow,
  getVideo,
  getVideosList, getVideosListPagination,
  killallServers,
  removeVideo,
  ServerInfo as DefaultServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo, viewVideo,
  wait
} from '../utils'
import { getJobsListPaginationAndSort } from '../utils/server/jobs'

interface ServerInfo extends DefaultServerInfo {
  requestsNumber: number
}

program
  .option('-c, --create [weight]', 'Weight for creating videos')
  .option('-r, --remove [weight]', 'Weight for removing videos')
  .option('-u, --update [weight]', 'Weight for updating videos')
  .option('-v, --view [weight]', 'Weight for viewing videos')
  .option('-l, --like [weight]', 'Weight for liking videos')
  .option('-s, --dislike [weight]', 'Weight for disliking videos')
  .option('-p, --servers [n]', 'Number of servers to run (3 or 6)', /^3|6$/, 3)
  .option('-i, --interval-action [interval]', 'Interval in ms for an action')
  .option('-I, --interval-integrity [interval]', 'Interval in ms for an integrity check')
  .option('-f, --flush', 'Flush data on exit')
  .option('-d, --difference', 'Display difference if integrity is not okay')
  .parse(process.argv)

const createWeight = program['create'] !== undefined ? parseInt(program['create'], 10) : 5
const removeWeight = program['remove'] !== undefined ? parseInt(program['remove'], 10) : 4
const updateWeight = program['update'] !== undefined ? parseInt(program['update'], 10) : 4
const viewWeight = program['view'] !== undefined ? parseInt(program['view'], 10) : 4
const likeWeight = program['like'] !== undefined ? parseInt(program['like'], 10) : 4
const dislikeWeight = program['dislike'] !== undefined ? parseInt(program['dislike'], 10) : 4
const flushAtExit = program['flush'] || false
const actionInterval = program['intervalAction'] !== undefined ? parseInt(program['intervalAction'], 10) : 500
const integrityInterval = program['intervalIntegrity'] !== undefined ? parseInt(program['intervalIntegrity'], 10) : 60000
const displayDiffOnFail = program['difference'] || false

const numberOfServers = 6

console.log(
  'Create weight: %d, update weight: %d, remove weight: %d, view weight: %d, like weight: %d, dislike weight: %d.',
  createWeight, updateWeight, removeWeight, viewWeight, likeWeight, dislikeWeight
)

if (flushAtExit) {
  console.log('Program will flush data on exit.')
} else {
  console.log('Program will not flush data on exit.')
}
if (displayDiffOnFail) {
  console.log('Program will display diff on failure.')
} else {
  console.log('Program will not display diff on failure')
}
console.log('Interval in ms for each action: %d.', actionInterval)
console.log('Interval in ms for each integrity check: %d.', integrityInterval)

console.log('Run servers...')

start()

// ----------------------------------------------------------------------------

async function start () {
  const servers = await runServers(numberOfServers)

  process.on('exit', async () => {
    await exitServers(servers, flushAtExit)

    return
  })
  process.on('SIGINT', goodbye)
  process.on('SIGTERM', goodbye)

  console.log('Servers ran')
  initializeRequestsPerServer(servers)

  let checking = false

  setInterval(async () => {
    if (checking === true) return

    const rand = getRandomInt(0, createWeight + updateWeight + removeWeight + viewWeight + likeWeight + dislikeWeight)

    const numServer = getRandomNumServer(servers)
    servers[numServer].requestsNumber++

    if (rand < createWeight) {
      await upload(servers, numServer)
    } else if (rand < createWeight + updateWeight) {
      await update(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight) {
      await remove(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight + viewWeight) {
      await view(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight + viewWeight + likeWeight) {
      await like(servers, numServer)
    } else {
      await dislike(servers, numServer)
    }
  }, actionInterval)

  // The function will check the consistency between servers (should have the same videos with same attributes...)
  setInterval(function () {
    if (checking === true) return

    console.log('Checking integrity...')
    checking = true

    const waitingInterval = setInterval(async () => {
      const pendingRequests = await isTherePendingRequests(servers)
      if (pendingRequests === true) {
        console.log('A server has pending requests, waiting...')
        return
      }

      // Even if there are no pending request, wait some potential processes
      await wait(2000)
      await checkIntegrity(servers)

      initializeRequestsPerServer(servers)
      checking = false
      clearInterval(waitingInterval)
    }, 10000)
  }, integrityInterval)
}

function initializeRequestsPerServer (servers: ServerInfo[]) {
  servers.forEach(server => server.requestsNumber = 0)
}

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function getRandomNumServer (servers) {
  return getRandomInt(0, servers.length)
}

async function runServers (numberOfServers: number) {
  const servers: ServerInfo[] = (await flushAndRunMultipleServers(numberOfServers))
    .map(s => Object.assign({ requestsNumber: 0 }, s))

  // Get the access tokens
  await setAccessTokensToServers(servers)

  for (let i = 0; i < numberOfServers; i++) {
    for (let j = 0; j < numberOfServers; j++) {
      if (i === j) continue

      await follow(servers[i].url, [ servers[j].url ], servers[i].accessToken)
    }
  }

  return servers
}

async function exitServers (servers: ServerInfo[], flushAtExit: boolean) {
  killallServers(servers)

  if (flushAtExit) await flushTests()
}

function upload (servers: ServerInfo[], numServer: number) {
  console.log('Uploading video to server ' + numServer)

  const videoAttributes = {
    name: Date.now() + ' name',
    category: 4,
    nsfw: false,
    licence: 2,
    language: 'en',
    description: Date.now() + ' description',
    tags: [ Date.now().toString().substring(0, 5) + 't1', Date.now().toString().substring(0, 5) + 't2' ],
    fixture: 'video_short1.webm'
  }
  return uploadVideo(servers[numServer].url, servers[numServer].accessToken, videoAttributes)
}

async function update (servers: ServerInfo[], numServer: number) {
  const res = await getVideosList(servers[numServer].url)

  const videos = res.body.data.filter(video => video.isLocal === true)
  if (videos.length === 0) return undefined

  const toUpdate = videos[getRandomInt(0, videos.length)].id
  const attributes = {
    name: Date.now() + ' name',
    description: Date.now() + ' description',
    tags: [ Date.now().toString().substring(0, 5) + 't1', Date.now().toString().substring(0, 5) + 't2' ]
  }

  console.log('Updating video of server ' + numServer)

  return updateVideo(servers[numServer].url, servers[numServer].accessToken, toUpdate, attributes)
}

async function remove (servers: ServerInfo[], numServer: number) {
  const res = await getVideosList(servers[numServer].url)
  const videos = res.body.data.filter(video => video.isLocal === true)
  if (videos.length === 0) return undefined

  const toRemove = videos[getRandomInt(0, videos.length)].id

  console.log('Removing video from server ' + numServer)
  return removeVideo(servers[numServer].url, servers[numServer].accessToken, toRemove)
}

async function view (servers: ServerInfo[], numServer: number) {
  const res = await getVideosList(servers[numServer].url)

  const videos = res.body.data
  if (videos.length === 0) return undefined

  const toView = videos[getRandomInt(0, videos.length)].id

  console.log('Viewing video from server ' + numServer)
  return viewVideo(servers[numServer].url, toView)
}

function like (servers: ServerInfo[], numServer: number) {
  return rate(servers, numServer, 'like')
}

function dislike (servers: ServerInfo[], numServer: number) {
  return rate(servers, numServer, 'dislike')
}

async function rate (servers: ServerInfo[], numServer: number, rating: VideoRateType) {
  const res = await getVideosList(servers[numServer].url)

  const videos = res.body.data
  if (videos.length === 0) return undefined

  const toRate = videos[getRandomInt(0, videos.length)].id

  console.log('Rating (%s) video from server %d', rating, numServer)
  return getVideo(servers[numServer].url, toRate)
}

async function checkIntegrity (servers: ServerInfo[]) {
  const videos: Video[][] = []
  const tasks: Promise<any>[] = []

  // Fetch all videos and remove some fields that can differ between servers
  for (const server of servers) {
    const p = getVideosListPagination(server.url, 0, 1000000, '-createdAt')
      .then(res => videos.push(res.body.data))
    tasks.push(p)
  }

  await Promise.all(tasks)

  let i = 0
  for (const video of videos) {
    const differences = areDifferences(video, videos[0])
    if (differences !== undefined) {
      console.error('Integrity not ok with server %d!', i + 1)

      if (displayDiffOnFail) {
        console.log(differences)
      }

      process.exit(-1)
    }

    i++
  }

  console.log('Integrity ok.')
}

function areDifferences (videos1: Video[], videos2: Video[]) {
  // Remove some keys we don't want to compare
  videos1.concat(videos2).forEach(video => {
    delete video.id
    delete video.isLocal
    delete video.thumbnailPath
    delete video.updatedAt
    delete video.views
  })

  if (videos1.length !== videos2.length) {
    return `Videos length are different (${videos1.length}/${videos2.length}).`
  }

  for (const video1 of videos1) {
    const video2 = videos2.find(video => video.uuid === video1.uuid)

    if (!video2) return 'Video ' + video1.uuid + ' is missing.'

    for (const videoKey of Object.keys(video1)) {
      const attribute1 = video1[videoKey]
      const attribute2 = video2[videoKey]

      if (videoKey === 'tags') {
        if (attribute1.length !== attribute2.length) {
          return 'Tags are different.'
        }

        attribute1.forEach(tag1 => {
          if (attribute2.indexOf(tag1) === -1) {
            return 'Tag ' + tag1 + ' is missing.'
          }
        })
      } else if (videoKey === 'files') {
        if (attribute1.length !== attribute2.length) {
          return 'Video files are different.'
        }

        attribute1.forEach((videoFile1: VideoFile) => {
          const videoFile2: VideoFile = attribute2.find(videoFile => videoFile.magnetUri === videoFile1.magnetUri)
          if (!videoFile2) {
            return `Video ${video1.uuid} has missing video file ${videoFile1.magnetUri}.`
          }

          if (videoFile1.size !== videoFile2.size || videoFile1.resolution.label !== videoFile2.resolution.label) {
            return `Video ${video1.uuid} has different video file ${videoFile1.magnetUri}.`
          }
        })
      } else {
        if (attribute1 !== attribute2) {
          return `Video ${video1.uuid} has different value for attribute ${videoKey}.`
        }
      }
    }
  }

  return undefined
}

function goodbye () {
  return process.exit(-1)
}

async function isTherePendingRequests (servers: ServerInfo[]) {
  const states: JobState[] = [ 'waiting', 'active', 'delayed' ]
  const tasks: Promise<any>[] = []
  let pendingRequests = false

  // Check if each server has pending request
  for (const server of servers) {
    for (const state of states) {
      const p = getJobsListPaginationAndSort(server.url, server.accessToken, state, 0, 10, '-createdAt')
        .then(res => {
          if (res.body.total > 0) pendingRequests = true
        })
      tasks.push(p)
    }
  }

  await Promise.all(tasks)

  return pendingRequests
}
