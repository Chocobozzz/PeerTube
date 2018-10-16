/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails } from '../../../../shared/models/videos'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  getFollowingListPaginationAndSort,
  getVideo,
  immutableAssign,
  killallServers, makeGetRequest,
  root,
  ServerInfo,
  setAccessTokensToServers, unfollow,
  uploadVideo,
  viewVideo,
  wait,
  waitUntilLog,
  checkVideoFilesWereRemoved, removeVideo
} from '../../utils'
import { waitJobs } from '../../utils/server/jobs'
import * as magnetUtil from 'magnet-uri'
import { updateRedundancy } from '../../utils/server/redundancy'
import { ActorFollow } from '../../../../shared/models/actors'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { VideoRedundancyStrategy } from '../../../../shared/models/redundancy'
import { getStats } from '../../utils/server/stats'
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
    redundancy: {
      videos: {
        check_interval: '5 seconds',
        strategies: [
          immutableAssign({
            min_lifetime: '1 hour',
            strategy: strategy,
            size: '100KB'
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

async function check1WebSeed (strategy: VideoRedundancyStrategy, videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  const webseeds = [
    'http://localhost:9002/static/webseed/' + videoUUID
  ]

  for (const server of servers) {
    {
      const res = await getVideo(server.url, videoUUID)

      const video: VideoDetails = res.body
      for (const f of video.files) {
        checkMagnetWebseeds(f, webseeds, server)
      }
    }
  }
}

async function checkStatsWith2Webseed (strategy: VideoRedundancyStrategy) {
  const res = await getStats(servers[0].url)
  const data: ServerStats = res.body

  expect(data.videosRedundancy).to.have.lengthOf(1)
  const stat = data.videosRedundancy[0]

  expect(stat.strategy).to.equal(strategy)
  expect(stat.totalSize).to.equal(102400)
  expect(stat.totalUsed).to.be.at.least(1).and.below(102401)
  expect(stat.totalVideoFiles).to.equal(4)
  expect(stat.totalVideos).to.equal(1)
}

async function checkStatsWith1Webseed (strategy: VideoRedundancyStrategy) {
  const res = await getStats(servers[0].url)
  const data: ServerStats = res.body

  expect(data.videosRedundancy).to.have.lengthOf(1)

  const stat = data.videosRedundancy[0]
  expect(stat.strategy).to.equal(strategy)
  expect(stat.totalSize).to.equal(102400)
  expect(stat.totalUsed).to.equal(0)
  expect(stat.totalVideoFiles).to.equal(0)
  expect(stat.totalVideos).to.equal(0)
}

async function check2Webseeds (strategy: VideoRedundancyStrategy, videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2UUID

  const webseeds = [
    'http://localhost:9001/static/webseed/' + videoUUID,
    'http://localhost:9002/static/webseed/' + videoUUID
  ]

  for (const server of servers) {
    const res = await getVideo(server.url, videoUUID)

    const video: VideoDetails = res.body

    for (const file of video.files) {
      checkMagnetWebseeds(file, webseeds, server)

      // Only servers 1 and 2 have the video
      if (server.serverNumber !== 3) {
        await makeGetRequest({
          url: server.url,
          statusCodeExpected: 200,
          path: '/static/webseed/' + `${videoUUID}-${file.resolution.id}.mp4`,
          contentType: null
        })
      }
    }
  }

  for (const directory of [ 'test1', 'test2' ]) {
    const files = await readdir(join(root(), directory, 'videos'))
    expect(files).to.have.length.at.least(4)

    for (const resolution of [ 240, 360, 480, 720 ]) {
      expect(files.find(f => f === `${videoUUID}-${resolution}.mp4`)).to.not.be.undefined
    }
  }
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
      await check1WebSeed(strategy)
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have 2 webseed on the first video', async function () {
      this.timeout(40000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 4)
      await waitJobs(servers)

      await check2Webseeds(strategy)
      await checkStatsWith2Webseed(strategy)
    })

    it('Should undo redundancy on server 1 and remove duplicated videos', async function () {
      this.timeout(40000)

      await disableRedundancyOnServer1()

      await waitJobs(servers)
      await wait(5000)

      await check1WebSeed(strategy)

      await checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, [ 'videos' ])
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
      await check1WebSeed(strategy)
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have 2 webseed on the first video', async function () {
      this.timeout(40000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 4)
      await waitJobs(servers)

      await check2Webseeds(strategy)
      await checkStatsWith2Webseed(strategy)
    })

    it('Should unfollow on server 1 and remove duplicated videos', async function () {
      this.timeout(40000)

      await unfollow(servers[0].url, servers[0].accessToken, servers[1])

      await waitJobs(servers)
      await wait(5000)

      await check1WebSeed(strategy)

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
      await check1WebSeed(strategy)
      await checkStatsWith1Webseed(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should still have 1 webseed on the first video', async function () {
      this.timeout(40000)

      await waitJobs(servers)
      await wait(15000)
      await waitJobs(servers)

      await check1WebSeed(strategy)
      await checkStatsWith1Webseed(strategy)
    })

    it('Should view 2 times the first video to have > min_views config', async function () {
      this.timeout(40000)

      await viewVideo(servers[ 0 ].url, video1Server2UUID)
      await viewVideo(servers[ 2 ].url, video1Server2UUID)

      await wait(10000)
      await waitJobs(servers)
    })

    it('Should have 2 webseed on the first video', async function () {
      this.timeout(40000)

      await waitJobs(servers)
      await waitUntilLog(servers[0], 'Duplicated ', 4)
      await waitJobs(servers)

      await check2Webseeds(strategy)
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
      this.timeout(40000)

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
      this.timeout(40000)

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
      await waitUntilLog(servers[0], 'Duplicated ', 4)
      await waitJobs(servers)

      await check2Webseeds(strategy)
      await checkStatsWith2Webseed(strategy)

      const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video 2 server 2' })
      video2Server2UUID = res.body.video.uuid
    })

    it('Should cache video 2 webseed on the first video', async function () {
      this.timeout(120000)

      await waitJobs(servers)

      let checked = false

      while (checked === false) {
        await wait(1000)

        try {
          await check1WebSeed(strategy, video1Server2UUID)
          await check2Webseeds(strategy, video2Server2UUID)

          checked = true
        } catch {
          checked = false
        }
      }
    })

    after(function () {
      return cleanServers()
    })
  })
})
