/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  VideoDetails,
  VideoPrivacy,
  VideoRedundancyStrategy,
  VideoRedundancyStrategyWithManual
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkSegmentHash } from '@tests/shared/streaming-playlists.js'
import { checkVideoFilesWereRemoved, saveVideoInServers } from '@tests/shared/videos.js'
import { expect } from 'chai'
import { readdir } from 'fs/promises'
import { basename, join } from 'path'

let servers: PeerTubeServer[] = []
let video1Server2: VideoDetails

async function createServers (strategy: VideoRedundancyStrategy | null, additionalParams: any = {}, withWebVideo = true) {
  const strategies: any[] = []

  if (strategy !== null) {
    strategies.push(
      {
        min_lifetime: '1 hour',
        strategy,
        size: '200KB',

        ...additionalParams
      }
    )
  }

  const config = {
    transcoding: {
      web_videos: {
        enabled: withWebVideo
      },
      hls: {
        enabled: true
      }
    },
    redundancy: {
      videos: {
        check_interval: '5 seconds',
        strategies
      }
    }
  }

  servers = await createMultipleServers(3, config)

  // Get the access tokens
  await setAccessTokensToServers(servers)

  {
    const { id } = await servers[1].videos.upload({ attributes: { name: 'video 1 server 2' } })
    video1Server2 = await servers[1].videos.get({ id })

    await servers[1].views.simulateView({ id })
  }

  await waitJobs(servers)

  // Server 1 and server 2 follow each other
  await doubleFollow(servers[0], servers[1])
  // Server 1 and server 3 follow each other
  await doubleFollow(servers[0], servers[2])
  // Server 2 and server 3 follow each other
  await doubleFollow(servers[1], servers[2])

  await waitJobs(servers)
}

async function ensureSameFilenames (videoUUID: string, serverArgs = servers) {
  let hlsFilenames: string[]

  for (const server of serverArgs) {
    const video = await server.videos.getWithToken({ id: videoUUID })

    // Ensure we use the same filenames as the origin
    const localHLSFilenames = video.streamingPlaylists[0].files.map(f => basename(f.fileUrl)).sort()

    if (hlsFilenames) expect(hlsFilenames).to.deep.equal(localHLSFilenames)
    else hlsFilenames = localHLSFilenames
  }

  return { hlsFilenames }
}

async function check0PlaylistRedundancies (videoUUID?: string, serverArgs = servers) {
  if (!videoUUID) videoUUID = video1Server2.uuid

  for (const server of serverArgs) {
    // With token to avoid issues with video follow constraints
    const video = await server.videos.getWithToken({ id: videoUUID })

    expect(video.streamingPlaylists).to.be.an('array')
    expect(video.streamingPlaylists).to.have.lengthOf(1)
    expect(video.streamingPlaylists[0].redundancies).to.have.lengthOf(0)
  }

  await ensureSameFilenames(videoUUID, serverArgs)
}

async function check1PlaylistRedundancies (videoUUID?: string) {
  if (!videoUUID) videoUUID = video1Server2.uuid

  for (const server of servers) {
    const video = await server.videos.get({ id: videoUUID })

    expect(video.streamingPlaylists).to.have.lengthOf(1)
    expect(video.streamingPlaylists[0].redundancies).to.have.lengthOf(1)

    const redundancy = video.streamingPlaylists[0].redundancies[0]

    expect(redundancy.baseUrl).to.equal(servers[0].url + '/static/redundancy/hls/' + videoUUID)
  }

  const baseUrlPlaylist = servers[1].url + '/static/streaming-playlists/hls/' + videoUUID
  const baseUrlSegment = servers[0].url + '/static/redundancy/hls/' + videoUUID

  const video = await servers[0].videos.get({ id: videoUUID })
  const hlsPlaylist = video.streamingPlaylists[0]

  for (const resolution of [ 240, 360, 480, 720 ]) {
    await checkSegmentHash({ server: servers[1], baseUrlPlaylist, baseUrlSegment, resolution, hlsPlaylist })
  }

  const { hlsFilenames } = await ensureSameFilenames(videoUUID)

  const directories = [
    servers[0].getDirectoryPath('redundancy/hls'),
    servers[1].getDirectoryPath('streaming-playlists/hls')
  ]

  for (const directory of directories) {
    const files = await readdir(join(directory, videoUUID))
    expect(files).to.have.length.at.least(4)

    // Ensure we files exist on disk
    expect(files.find(f => hlsFilenames.includes(f))).to.exist
  }
}

async function checkStatsGlobal (strategy: VideoRedundancyStrategyWithManual) {
  let totalSize: number = null
  let statsLength = 1

  if (strategy !== 'manual') {
    totalSize = 204800
    statsLength = 2
  }

  const data = await servers[0].stats.get()
  expect(data.videosRedundancy).to.have.lengthOf(statsLength)

  const stat = data.videosRedundancy[0]
  expect(stat.strategy).to.equal(strategy)
  expect(stat.totalSize).to.equal(totalSize)

  return stat
}

async function checkStatsWith1Redundancy (strategy: VideoRedundancyStrategyWithManual) {
  const stat = await checkStatsGlobal(strategy)

  expect(stat.totalUsed).to.be.at.least(1).and.below(204801)
  expect(stat.totalVideoFiles).to.equal(4)
  expect(stat.totalVideos).to.equal(1)
}

async function checkStatsWithoutRedundancy (strategy: VideoRedundancyStrategyWithManual) {
  const stat = await checkStatsGlobal(strategy)

  expect(stat.totalUsed).to.equal(0)
  expect(stat.totalVideoFiles).to.equal(0)
  expect(stat.totalVideos).to.equal(0)
}

async function findServerFollows () {
  const body = await servers[0].follows.getFollowings({ start: 0, count: 5, sort: '-createdAt' })
  const follows = body.data
  const server2 = follows.find(f => f.following.host === `${servers[1].host}`)
  const server3 = follows.find(f => f.following.host === `${servers[2].host}`)

  return { server2, server3 }
}

async function enableRedundancyOnServer1 () {
  await servers[0].redundancy.updateRedundancy({ host: servers[1].host, redundancyAllowed: true })

  const { server2, server3 } = await findServerFollows()

  expect(server3).to.not.be.undefined
  expect(server3.following.hostRedundancyAllowed).to.be.false

  expect(server2).to.not.be.undefined
  expect(server2.following.hostRedundancyAllowed).to.be.true
}

async function disableRedundancyOnServer1 () {
  await servers[0].redundancy.updateRedundancy({ host: servers[1].host, redundancyAllowed: false })

  const { server2, server3 } = await findServerFollows()

  expect(server3).to.not.be.undefined
  expect(server3.following.hostRedundancyAllowed).to.be.false

  expect(server2).to.not.be.undefined
  expect(server2.following.hostRedundancyAllowed).to.be.false
}

describe('Test videos redundancy', function () {

  describe('With most-views strategy', function () {
    const strategy = 'most-views'

    before(function () {
      this.timeout(240000)

      return createServers(strategy)
    })

    it('Should not have redundancy', async function () {
      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)
    })

    it('Should undo redundancy on server 1 and remove duplicated videos', async function () {
      this.timeout(80000)

      await disableRedundancyOnServer1()

      await waitJobs(servers)
      await wait(5000)

      await check0PlaylistRedundancies()

      await checkVideoFilesWereRemoved({ server: servers[0], video: video1Server2, onlyVideoFiles: true })
    })

    after(async function () {
      return cleanupTests(servers)
    })
  })

  describe('With trending strategy', function () {
    const strategy = 'trending'

    before(function () {
      this.timeout(240000)

      return createServers(strategy)
    })

    it('Should not have redundancy on the first video', async function () {
      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should have redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)
    })

    it('Should unfollow server 3 and keep duplicated videos', async function () {
      this.timeout(80000)

      await servers[0].follows.unfollow({ target: servers[2] })

      await waitJobs(servers)
      await wait(5000)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)
    })

    it('Should unfollow server 2 and remove duplicated videos', async function () {
      this.timeout(80000)

      await servers[0].follows.unfollow({ target: servers[1] })

      await waitJobs(servers)
      await wait(5000)

      await check0PlaylistRedundancies()

      await checkVideoFilesWereRemoved({ server: servers[0], video: video1Server2, onlyVideoFiles: true })
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('With recently added strategy', function () {
    const strategy = 'recently-added'

    before(function () {
      this.timeout(240000)

      return createServers(strategy, { min_views: 3 })
    })

    it('Should not have redundancy on the first video', async function () {
      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy(strategy)
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should still not have redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await wait(15000)
      await waitJobs(servers)

      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy(strategy)
    })

    it('Should view 2 times the first video to have > min_views config', async function () {
      this.timeout(80000)

      await servers[0].views.simulateView({ id: video1Server2.uuid })
      await servers[2].views.simulateView({ id: video1Server2.uuid })

      await wait(10000)
      await waitJobs(servers)
    })

    it('Should now have redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)
    })

    it('Should remove the video and the redundancy files', async function () {
      this.timeout(20000)

      await saveVideoInServers(servers, video1Server2.uuid)
      await servers[1].videos.remove({ id: video1Server2.uuid })

      await waitJobs(servers)

      for (const server of servers) {
        await checkVideoFilesWereRemoved({ server, video: server.store.videoDetails })
      }
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('With only HLS files', function () {
    const strategy = 'recently-added'

    before(async function () {
      this.timeout(240000)

      await createServers(strategy, { min_views: 3 }, false)
    })

    it('Should have 0 playlist redundancy on the first video', async function () {
      await check0PlaylistRedundancies()
    })

    it('Should enable redundancy on server 1', function () {
      return enableRedundancyOnServer1()
    })

    it('Should still have 0 redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await wait(15000)
      await waitJobs(servers)

      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy(strategy)
    })

    it('Should have 1 redundancy on the first video', async function () {
      this.timeout(160000)

      await servers[0].views.simulateView({ id: video1Server2.uuid })
      await servers[2].views.simulateView({ id: video1Server2.uuid })

      await wait(10000)
      await waitJobs(servers)

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)
    })

    it('Should remove the video and the redundancy files', async function () {
      this.timeout(20000)

      await saveVideoInServers(servers, video1Server2.uuid)
      await servers[1].videos.remove({ id: video1Server2.uuid })

      await waitJobs(servers)

      for (const server of servers) {
        await checkVideoFilesWereRemoved({ server, video: server.store.videoDetails })
      }
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('With manual strategy', function () {
    before(function () {
      this.timeout(240000)

      return createServers(null)
    })

    it('Should not have redundancy on the first video', async function () {
      await check0PlaylistRedundancies()
      await checkStatsWithoutRedundancy('manual')
    })

    it('Should create a redundancy on first video', async function () {
      await servers[0].redundancy.addVideo({ videoId: video1Server2.id })
    })

    it('Should now have redundancy on the first video', async function () {
      this.timeout(80000)

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy('manual')
    })

    it('Should manually remove redundancies on server 1 and remove duplicated videos', async function () {
      this.timeout(80000)

      const body = await servers[0].redundancy.listVideos({ target: 'remote-videos' })

      const videos = body.data
      expect(videos).to.have.lengthOf(1)

      const video = videos[0]

      for (const r of video.redundancies.streamingPlaylists) {
        await servers[0].redundancy.removeVideo({ redundancyId: r.id })
      }

      await waitJobs(servers)
      await wait(5000)

      await check0PlaylistRedundancies()

      await checkVideoFilesWereRemoved({ server: servers[0], video: video1Server2, onlyVideoFiles: true })
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('Test expiration', function () {
    const strategy = 'recently-added'

    before(async function () {
      this.timeout(240000)

      await createServers(strategy, { min_lifetime: '7 seconds', min_views: 0 })

      await enableRedundancyOnServer1()
    })

    it('Should still have redundancy after 10 seconds', async function () {
      this.timeout(80000)

      await wait(10000)

      try {
        await check1PlaylistRedundancies()
      } catch {
        // Maybe a server deleted a redundancy in the scheduler
        await wait(2000)

        await check1PlaylistRedundancies()
      }
    })

    it('Should stop server 1 and expire video redundancy', async function () {
      this.timeout(80000)

      await killallServers([ servers[0] ])

      await wait(15000)

      await check0PlaylistRedundancies(video1Server2.uuid, [ servers[1], servers[2] ])
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('Test file replacement', function () {
    let video2Server2UUID: string
    const strategy = 'recently-added'

    before(async function () {
      this.timeout(240000)

      await createServers(strategy, { min_lifetime: '7 seconds', min_views: 0 })

      await enableRedundancyOnServer1()

      await waitJobs(servers)
      await servers[0].servers.waitUntilLog('Duplicated playlist ', 1)
      await waitJobs(servers)

      await check1PlaylistRedundancies()
      await checkStatsWith1Redundancy(strategy)

      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video 2 server 2', privacy: VideoPrivacy.PRIVATE } })
      video2Server2UUID = uuid

      // Wait transcoding before federation
      await waitJobs(servers)

      await servers[1].videos.update({ id: video2Server2UUID, attributes: { privacy: VideoPrivacy.PUBLIC } })
    })

    it('Should replace first video redundancy by video 2', async function () {
      this.timeout(240000)

      await waitJobs(servers)

      let checked = false

      while (checked === false) {
        await wait(1000)

        try {
          await check0PlaylistRedundancies()

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

      await killallServers([ servers[0] ])
      await servers[0].run({
        redundancy: {
          videos: {
            check_interval: '1 second',
            strategies: []
          }
        }
      })

      await waitJobs(servers)

      await checkVideoFilesWereRemoved({ server: servers[0], video: video1Server2, onlyVideoFiles: true })
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })
})
