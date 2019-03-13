/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails } from '../../../../shared/models/videos'
import {
  checkSegmentHash,
  checkVideoFilesWereRemoved,
  doubleFollow,
  flushAndRunMultipleServers,
  getFollowingListPaginationAndSort,
  getVideo,
  getVideoWithToken,
  immutableAssign,
  killallServers,
  makeGetRequest,
  removeVideo,
  reRunServer,
  root,
  ServerInfo,
  setAccessTokensToServers,
  unfollow,
  uploadVideo,
  viewVideo,
  wait,
  waitUntilLog
} from '../../../../shared/utils'
import { waitJobs } from '../../../../shared/utils/server/jobs'

import * as magnetUtil from 'magnet-uri'
import { updateRedundancy } from '../../../../shared/utils/server/redundancy'
import { ActorFollow } from '../../../../shared/models/actors'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { VideoRedundancyStrategy } from '../../../../shared/models/redundancy'
import { getStats } from '../../../../shared/utils/server/stats'
import { ServerStats } from '../../../../shared/models/server/server-stats.model'

const expect = chai.expect

let servers: ServerInfo[] = []
let video1Server2UUID: string

function checkMagnetWebseeds (file: { magnetUri: string, resolution: { id: number } }, baseWebseeds: string[], server: ServerInfo) {
  const parsed = magnetUtil.decode(file.magnetUri)

  for (const ws of baseWebseeds) {
    const found = parsed.urlList.find(url => url === `${ws}-${file.resolution.id}.mp4`)
    expect(found, `Webseed ${ws} not found in ${file.magnetUri} on server ${server.url}`).to.not.be.undefined
  }

  expect(parsed.urlList).to.have.lengthOf(baseWebseeds.length)
}

async function runServers (strategy: VideoRedundancyStrategy, additionalParams: any = {}) {
  const config = {
    transcoding: {
      hls: {
        enabled: true
      }
    },
    redundancy: {
      videos: {
        check_interval: '5 seconds',
        strategies: [
          immutableAssign({
            min_lifetime: '1 hour',
            strategy: strategy,
            size: '200KB'
          }, additionalParams)
        ]
      }
    }
  }
  servers = await flushAndRunMultipleServers(3, config)

  // Get the access tokens
  await setAccessTokensToServers(servers)

  {
    const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video 1 server 2' })
    video1Server2UUID = res.body.video.uuid

    await viewVideo(servers[ 1 ].url, video1Server2UUID)
  }

  await waitJobs(servers)

  // Server 1 and server 2 follow each other
  await doubleFollow(servers[ 0 ], servers[ 1 ])
  // Server 1 and server 3 follow each other
  await doubleFollow(servers[ 0 ], servers[ 2 ])
  // Server 2 and server 3 follow each other
  await doubleFollow(servers[ 1 ], servers[ 2 ])

  await waitJobs(servers)
}

async function check1WebSeed (videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  const webseeds = [
    'http://localhost:9002/static/webseed/' + videoUUID
  ]

  for (const server of servers) {
    // With token to avoid issues with video follow constraints
    const res = await getVideoWithToken(server.url, server.accessToken, videoUUID)

    const video: VideoDetails = res.body
    for (const f of video.files) {
      checkMagnetWebseeds(f, webseeds, server)
    }
  }
}

async function check2Webseeds (videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  const webseeds = [
    'http://localhost:9001/static/redundancy/' + videoUUID,
    'http://localhost:9002/static/webseed/' + videoUUID
  ]

  for (const server of servers) {
    const res = await getVideo(server.url, videoUUID)

    const video: VideoDetails = res.body

    for (const file of video.files) {
      checkMagnetWebseeds(file, webseeds, server)

      await makeGetRequest({
        url: servers[0].url,
        statusCodeExpected: 200,
        path: '/static/redundancy/' + `${videoUUID}-${file.resolution.id}.mp4`,
        contentType: null
      })
      await makeGetRequest({
        url: servers[1].url,
        statusCodeExpected: 200,
        path: `/static/webseed/${videoUUID}-${file.resolution.id}.mp4`,
        contentType: null
      })
    }
  }

  for (const directory of [ 'test1/redundancy', 'test2/videos' ]) {
    const files = await readdir(join(root(), directory))
    expect(files).to.have.length.at.least(4)

    for (const resolution of [ 240, 360, 480, 720 ]) {
      expect(files.find(f => f === `${videoUUID}-${resolution}.mp4`)).to.not.be.undefined
    }
  }
}

async function check0PlaylistRedundancies (videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  for (const server of servers) {
    // With token to avoid issues with video follow constraints
    const res = await getVideoWithToken(server.url, server.accessToken, videoUUID)
    const video: VideoDetails = res.body

    expect(video.streamingPlaylists).to.be.an('array')
    expect(video.streamingPlaylists).to.have.lengthOf(1)
    expect(video.streamingPlaylists[0].redundancies).to.have.lengthOf(0)
  }
}

async function check1PlaylistRedundancies (videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  for (const server of servers) {
    const res = await getVideo(server.url, videoUUID)
    const video: VideoDetails = res.body

    expect(video.streamingPlaylists).to.have.lengthOf(1)
    expect(video.streamingPlaylists[0].redundancies).to.have.lengthOf(1)

    const redundancy = video.streamingPlaylists[0].redundancies[0]

    expect(redundancy.baseUrl).to.equal(servers[0].url + '/static/redundancy/hls/' + videoUUID)
  }

  const baseUrlPlaylist = servers[1].url + '/static/streaming-playlists/hls'
  const baseUrlSegment = servers[0].url + '/static/redundancy/hls'

  const res = await getVideo(servers[0].url, videoUUID)
  const hlsPlaylist = (res.body as VideoDetails).streamingPlaylists[0]

  for (const resolution of [ 240, 360, 480, 720 ]) {
    await checkSegmentHash(baseUrlPlaylist, baseUrlSegment, videoUUID, resolution, hlsPlaylist)
  }

  for (const directory of [ 'test1/redundancy/hls', 'test2/streaming-playlists/hls' ]) {
    const files = await readdir(join(root(), directory, videoUUID))
    expect(files).to.have.length.at.least(4)

    for (const resolution of [ 240, 360, 480, 720 ]) {
      const filename = `${videoUUID}-${resolution}-fragmented.mp4`

      expect(files.find(f => f === filename)).to.not.be.undefined
    }
  }
}

async function checkStatsWith2Webseed (strategy: VideoRedundancyStrategy) {
  const res = await getStats(servers[0].url)
  const data: ServerStats = res.body

  expect(data.videosRedundancy).to.have.lengthOf(1)
  const stat = data.videosRedundancy[0]

  expect(stat.strategy).to.equal(strategy)
  expect(stat.totalSize).to.equal(204800)
  expect(stat.totalUsed).to.be.at.least(1).and.below(204801)
  expect(stat.totalVideoFiles).to.equal(4)
  expect(stat.totalVideos).to.equal(1)
}

async function checkStatsWith1Webseed (strategy: VideoRedundancyStrategy) {
  const res = await getStats(servers[0].url)
  const data: ServerStats = res.body

  expect(data.videosRedundancy).to.have.lengthOf(1)

  const stat = data.videosRedundancy[0]
  expect(stat.strategy).to.equal(strategy)
  expect(stat.totalSize).to.equal(204800)
  expect(stat.totalUsed).to.equal(0)
  expect(stat.totalVideoFiles).to.equal(0)
  expect(stat.totalVideos).to.equal(0)
}

async function enableRedundancyOnServer1 () {
  await updateRedundancy(servers[ 0 ].url, servers[ 0 ].accessToken, servers[ 1 ].host, true)

  const res = await getFollowingListPaginationAndSort(servers[ 0 ].url, 0, 5, '-createdAt')
  const follows: ActorFollow[] = res.body.data
  const server2 = follows.find(f => f.following.host === 'localhost:9002')
  const server3 = follows.find(f => f.following.host === 'localhost:9003')

  expect(server3).to.not.be.undefined
  expect(server3.following.hostRedundancyAllowed).to.be.false

  expect(server2).to.not.be.undefined
  expect(server2.following.hostRedundancyAllowed).to.be.true
}

async function disableRedundancyOnServer1 () {
  await updateRedundancy(servers[ 0 ].url, servers[ 0 ].accessToken, servers[ 1 ].host, false)

  const res = await getFollowingListPaginationAndSort(servers[ 0 ].url, 0, 5, '-createdAt')
  const follows: ActorFollow[] = res.body.data
  const server2 = follows.find(f => f.following.host === 'localhost:9002')
  const server3 = follows.find(f => f.following.host === 'localhost:9003')

  expect(server3).to.not.be.undefined
  expect(server3.following.hostRedundancyAllowed).to.be.false

  expect(server2).to.not.be.undefined
  expect(server2.following.hostRedundancyAllowed).to.be.false
}

async function cleanServers () {
  killallServers(servers)
}

describe('Test videos redundancy', function () {

  describe('With most-views strategy', function () {
    const strategy = 'most-views'

    before(function () {
      this.timeout(120000)

      return runServers(strategy)
    })

    it('Should have 1 webseed on the first video', async function () {
      await check1WebSeed()
      await check0PlaylistRedundancies()
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have 2 webseeds on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 5)
      await waitJobs(servers)

      await check2Webseeds()
      await check1PlaylistRedundancies()
      await checkStatsWith2Webseed(strategy)
    })

    it('Should undo redundancy on server 1 and remove duplicated videos', async function () {
      this.timeout(80000)

      await disableRedundancyOnServer1()

      await waitJobs(servers)
      await wait(5000)

      await check1WebSeed()
      await check0PlaylistRedundancies()

      await checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, [ 'videos', join('playlists', 'hls') ])
    })

    after(function () {
      return cleanServers()
    })
  })

  describe('With trending strategy', function () {
    const strategy = 'trending'

    before(function () {
      this.timeout(120000)

      return runServers(strategy)
    })

    it('Should have 1 webseed on the first video', async function () {
      await check1WebSeed()
      await check0PlaylistRedundancies()
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have 2 webseeds on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 5)
      await waitJobs(servers)

      await check2Webseeds()
      await check1PlaylistRedundancies()
      await checkStatsWith2Webseed(strategy)
    })

    it('Should unfollow on server 1 and remove duplicated videos', async function () {
      this.timeout(80000)

      await unfollow(servers[0].url, servers[0].accessToken, servers[1])

      await waitJobs(servers)
      await wait(5000)

      await check1WebSeed()
      await check0PlaylistRedundancies()

      await checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, [ 'videos' ])
    })

    after(function () {
      return cleanServers()
    })
  })

  describe('With recently added strategy', function () {
    const strategy = 'recently-added'

    before(function () {
      this.timeout(120000)

      return runServers(strategy, { min_views: 3 })
    })

    it('Should have 1 webseed on the first video', async function () {
      await check1WebSeed()
      await check0PlaylistRedundancies()
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should still have 1 webseed on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await wait(15000)
      await waitJobs(servers)

      await check1WebSeed()
      await check0PlaylistRedundancies()
      await checkStatsWith1Webseed(strategy)
    })

    it('Should view 2 times the first video to have > min_views config', async function () {
      this.timeout(80000)

      await viewVideo(servers[ 0 ].url, video1Server2UUID)
      await viewVideo(servers[ 2 ].url, video1Server2UUID)

      await wait(10000)
      await waitJobs(servers)
    })

    it('Should have 2 webseeds on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 5)
      await waitJobs(servers)

      await check2Webseeds()
      await check1PlaylistRedundancies()
      await checkStatsWith2Webseed(strategy)
    })

    it('Should remove the video and the redundancy files', async function () {
      this.timeout(20000)

      await removeVideo(servers[1].url, servers[1].accessToken, video1Server2UUID)

      await waitJobs(servers)

      for (const server of servers) {
        await checkVideoFilesWereRemoved(video1Server2UUID, server.serverNumber)
      }
    })

    after(function () {
      return cleanServers()
    })
  })

  describe('Test expiration', function () {
    const strategy = 'recently-added'

    async function checkContains (servers: ServerInfo[], str: string) {
      for (const server of servers) {
        const res = await getVideo(server.url, video1Server2UUID)
        const video: VideoDetails = res.body

        for (const f of video.files) {
          expect(f.magnetUri).to.contain(str)
        }
      }
    }

    async function checkNotContains (servers: ServerInfo[], str: string) {
      for (const server of servers) {
        const res = await getVideo(server.url, video1Server2UUID)
        const video: VideoDetails = res.body

        for (const f of video.files) {
          expect(f.magnetUri).to.not.contain(str)
        }
      }
    }

    before(async function () {
      this.timeout(120000)

      await runServers(strategy, { min_lifetime: '7 seconds', min_views: 0 })

      await enableRedundancyOnServer1()
    })

    it('Should still have 2 webseeds after 10 seconds', async function () {
      this.timeout(80000)

      await wait(10000)

      try {
        await checkContains(servers, 'http%3A%2F%2Flocalhost%3A9001')
      } catch {
        // Maybe a server deleted a redundancy in the scheduler
        await wait(2000)

        await checkContains(servers, 'http%3A%2F%2Flocalhost%3A9001')
      }
    })

    it('Should stop server 1 and expire video redundancy', async function () {
      this.timeout(80000)

      killallServers([ servers[0] ])

      await wait(15000)

      await checkNotContains([ servers[1], servers[2] ], 'http%3A%2F%2Flocalhost%3A9001')
    })

    after(function () {
      return killallServers([ servers[1], servers[2] ])
    })
  })

  describe('Test file replacement', function () {
    let video2Server2UUID: string
    const strategy = 'recently-added'

    before(async function () {
      this.timeout(120000)

      await runServers(strategy, { min_lifetime: '7 seconds', min_views: 0 })

      await enableRedundancyOnServer1()

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 5)
      await waitJobs(servers)

      await check2Webseeds()
      await check1PlaylistRedundancies()
      await checkStatsWith2Webseed(strategy)

      const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video 2 server 2' })
      video2Server2UUID = res.body.video.uuid
    })

    it('Should cache video 2 webseeds on the first video', async function () {
      this.timeout(120000)

      await waitJobs(servers)

      let checked = false

      while (checked === false) {
        await wait(1000)

        try {
          await check1WebSeed(video1Server2UUID)
          await check0PlaylistRedundancies(video1Server2UUID)
          await check2Webseeds(video2Server2UUID)
          await check1PlaylistRedundancies(video2Server2UUID)

          checked = true
        } catch {
          checked = false
        }
      }
    })

    it('Should disable strategy and remove redundancies', async function () {
      this.timeout(80000)

      await waitJobs(servers)

      killallServers([ servers[ 0 ] ])
      await reRunServer(servers[ 0 ], {
        redundancy: {
          videos: {
            check_interval: '1 second',
            strategies: []
          }
        }
      })

      await waitJobs(servers)

      await checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, [ join('redundancy', 'hls') ])
    })

    after(function () {
      return cleanServers()
    })
  })
})
