/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { prepareViewsServers, prepareViewsVideos, processViewersStats } from '@server/tests/shared'
import { cleanupTests, PeerTubeServer, stopFfmpeg, waitJobs } from '@shared/server-commands'
import { wait } from '@shared/core-utils'
import { VideoStatsOverall } from '@shared/models'

/**
 *
 * Simulate 5 sections of viewers
 *  * user0 started and ended before start date
 *  * user1 started before start date and ended in the interval
 *  * user2 started started in the interval and ended after end date
 *  * user3 started and ended in the interval
 *  * user4 started and ended after end date
 */
async function simulateComplexViewers (servers: PeerTubeServer[], videoUUID: string) {
  const user0 = '8.8.8.8,127.0.0.1'
  const user1 = '8.8.8.8,127.0.0.1'
  const user2 = '8.8.8.9,127.0.0.1'
  const user3 = '8.8.8.10,127.0.0.1'
  const user4 = '8.8.8.11,127.0.0.1'

  await servers[0].views.view({ id: videoUUID, currentTime: 0, xForwardedFor: user0 }) // User 0 starts
  await wait(500)

  await servers[0].views.view({ id: videoUUID, currentTime: 0, xForwardedFor: user1 }) // User 1 starts
  await servers[0].views.view({ id: videoUUID, currentTime: 2, xForwardedFor: user0 }) // User 0 ends
  await wait(500)

  const startDate = new Date().toISOString()
  await servers[0].views.view({ id: videoUUID, currentTime: 0, xForwardedFor: user2 }) // User 2 starts
  await wait(500)

  await servers[0].views.view({ id: videoUUID, currentTime: 0, xForwardedFor: user3 }) // User 3 starts
  await wait(500)

  await servers[0].views.view({ id: videoUUID, currentTime: 4, xForwardedFor: user1 }) // User 1 ends
  await wait(500)

  await servers[0].views.view({ id: videoUUID, currentTime: 3, xForwardedFor: user3 }) // User 3 ends
  await wait(500)

  const endDate = new Date().toISOString()
  await servers[0].views.view({ id: videoUUID, currentTime: 0, xForwardedFor: user4 }) // User 4 starts
  await servers[0].views.view({ id: videoUUID, currentTime: 5, xForwardedFor: user2 }) // User 2 ends
  await wait(500)

  await servers[0].views.view({ id: videoUUID, currentTime: 1, xForwardedFor: user4 }) // User 4 ends

  await processViewersStats(servers)

  return { startDate, endDate }
}

describe('Test views overall stats', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await prepareViewsServers()
  })

  describe('Test watch time stats of local videos on live and VOD', function () {
    let vodVideoId: string
    let liveVideoId: string
    let command: FfmpegCommand

    before(async function () {
      this.timeout(240000);

      ({ vodVideoId, liveVideoId, ffmpegCommand: command } = await prepareViewsVideos({ servers, live: true, vod: true }))
    })

    it('Should display overall stats of a video with no viewers', async function () {
      for (const videoId of [ liveVideoId, vodVideoId ]) {
        const stats = await servers[0].videoStats.getOverallStats({ videoId })
        const video = await servers[0].videos.get({ id: videoId })

        expect(video.views).to.equal(0)
        expect(stats.averageWatchTime).to.equal(0)
        expect(stats.totalWatchTime).to.equal(0)
        expect(stats.totalViewers).to.equal(0)
      }
    })

    it('Should display overall stats with 1 viewer below the watch time limit', async function () {
      this.timeout(60000)

      for (const videoId of [ liveVideoId, vodVideoId ]) {
        await servers[0].views.simulateViewer({ id: videoId, currentTimes: [ 0, 1 ] })
      }

      await processViewersStats(servers)

      for (const videoId of [ liveVideoId, vodVideoId ]) {
        const stats = await servers[0].videoStats.getOverallStats({ videoId })
        const video = await servers[0].videos.get({ id: videoId })

        expect(video.views).to.equal(0)
        expect(stats.averageWatchTime).to.equal(1)
        expect(stats.totalWatchTime).to.equal(1)
        expect(stats.totalViewers).to.equal(1)
      }
    })

    it('Should display overall stats with 2 viewers', async function () {
      this.timeout(60000)

      {
        await servers[0].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 3 ] })
        await servers[0].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35, 40 ] })

        await processViewersStats(servers)

        {
          const stats = await servers[0].videoStats.getOverallStats({ videoId: vodVideoId })
          const video = await servers[0].videos.get({ id: vodVideoId })

          expect(video.views).to.equal(1)
          expect(stats.averageWatchTime).to.equal(2)
          expect(stats.totalWatchTime).to.equal(4)
          expect(stats.totalViewers).to.equal(2)
        }

        {
          const stats = await servers[0].videoStats.getOverallStats({ videoId: liveVideoId })
          const video = await servers[0].videos.get({ id: liveVideoId })

          expect(video.views).to.equal(1)
          expect(stats.averageWatchTime).to.equal(21)
          expect(stats.totalWatchTime).to.equal(41)
          expect(stats.totalViewers).to.equal(2)
        }
      }
    })

    it('Should display overall stats with a remote viewer below the watch time limit', async function () {
      this.timeout(60000)

      for (const videoId of [ liveVideoId, vodVideoId ]) {
        await servers[1].views.simulateViewer({ id: videoId, currentTimes: [ 0, 2 ] })
      }

      await processViewersStats(servers)

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: vodVideoId })
        const video = await servers[0].videos.get({ id: vodVideoId })

        expect(video.views).to.equal(1)
        expect(stats.averageWatchTime).to.equal(2)
        expect(stats.totalWatchTime).to.equal(6)
        expect(stats.totalViewers).to.equal(3)
      }

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: liveVideoId })
        const video = await servers[0].videos.get({ id: liveVideoId })

        expect(video.views).to.equal(1)
        expect(stats.averageWatchTime).to.equal(14)
        expect(stats.totalWatchTime).to.equal(43)
        expect(stats.totalViewers).to.equal(3)
      }
    })

    it('Should display overall stats with a remote viewer above the watch time limit', async function () {
      this.timeout(60000)

      await servers[1].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })
      await servers[1].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 45 ] })
      await processViewersStats(servers)

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: vodVideoId })
        const video = await servers[0].videos.get({ id: vodVideoId })

        expect(video.views).to.equal(2)
        expect(stats.averageWatchTime).to.equal(3)
        expect(stats.totalWatchTime).to.equal(11)
        expect(stats.totalViewers).to.equal(4)
      }

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: liveVideoId })
        const video = await servers[0].videos.get({ id: liveVideoId })

        expect(video.views).to.equal(2)
        expect(stats.averageWatchTime).to.equal(22)
        expect(stats.totalWatchTime).to.equal(88)
        expect(stats.totalViewers).to.equal(4)
      }
    })

    it('Should filter overall stats by date', async function () {
      this.timeout(60000)

      const beforeView = new Date()

      await servers[0].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 3 ] })
      await processViewersStats(servers)

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: vodVideoId, startDate: beforeView.toISOString() })
        expect(stats.averageWatchTime).to.equal(3)
        expect(stats.totalWatchTime).to.equal(3)
        expect(stats.totalViewers).to.equal(1)
      }

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: liveVideoId, endDate: beforeView.toISOString() })
        expect(stats.averageWatchTime).to.equal(22)
        expect(stats.totalWatchTime).to.equal(88)
        expect(stats.totalViewers).to.equal(4)
      }
    })

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  describe('Test watchers peak stats of local videos on VOD', function () {
    let videoUUID: string
    let before2Watchers: Date

    before(async function () {
      this.timeout(240000);

      ({ vodVideoId: videoUUID } = await prepareViewsVideos({ servers, live: true, vod: true }))
    })

    it('Should not have watchers peak', async function () {
      const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID })

      expect(stats.viewersPeak).to.equal(0)
      expect(stats.viewersPeakDate).to.be.null
    })

    it('Should have watcher peak with 1 watcher', async function () {
      this.timeout(60000)

      const before = new Date()
      await servers[0].views.simulateViewer({ id: videoUUID, currentTimes: [ 0, 2 ] })
      const after = new Date()

      await processViewersStats(servers)

      const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID })

      expect(stats.viewersPeak).to.equal(1)
      expect(new Date(stats.viewersPeakDate)).to.be.above(before).and.below(after)
    })

    it('Should have watcher peak with 2 watchers', async function () {
      this.timeout(60000)

      before2Watchers = new Date()
      await servers[0].views.view({ id: videoUUID, currentTime: 0 })
      await servers[1].views.view({ id: videoUUID, currentTime: 0 })
      await servers[0].views.view({ id: videoUUID, currentTime: 2 })
      await servers[1].views.view({ id: videoUUID, currentTime: 2 })
      const after = new Date()

      await processViewersStats(servers)

      const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID })

      expect(stats.viewersPeak).to.equal(2)
      expect(new Date(stats.viewersPeakDate)).to.be.above(before2Watchers).and.below(after)
    })

    it('Should filter peak viewers stats by date', async function () {
      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID, startDate: new Date().toISOString() })
        expect(stats.viewersPeak).to.equal(0)
        expect(stats.viewersPeakDate).to.not.exist
      }

      {
        const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID, endDate: before2Watchers.toISOString() })
        expect(stats.viewersPeak).to.equal(1)
        expect(new Date(stats.viewersPeakDate)).to.be.below(before2Watchers)
      }
    })

    it('Should complex filter peak viewers by date', async function () {
      this.timeout(60000)

      const { startDate, endDate } = await simulateComplexViewers(servers, videoUUID)

      const expectCorrect = (stats: VideoStatsOverall) => {
        expect(stats.viewersPeak).to.equal(3)
        expect(new Date(stats.viewersPeakDate)).to.be.above(new Date(startDate)).and.below(new Date(endDate))
      }

      expectCorrect(await servers[0].videoStats.getOverallStats({ videoId: videoUUID, startDate, endDate }))
      expectCorrect(await servers[0].videoStats.getOverallStats({ videoId: videoUUID, startDate }))
      expectCorrect(await servers[0].videoStats.getOverallStats({ videoId: videoUUID, endDate }))
      expectCorrect(await servers[0].videoStats.getOverallStats({ videoId: videoUUID }))
    })
  })

  describe('Test countries', function () {
    let videoUUID: string

    it('Should not report countries if geoip is disabled', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      await servers[1].views.view({ id: uuid, xForwardedFor: '8.8.8.8,127.0.0.1', currentTime: 1 })

      await processViewersStats(servers)

      const stats = await servers[0].videoStats.getOverallStats({ videoId: uuid })
      expect(stats.countries).to.have.lengthOf(0)
    })

    it('Should report countries if geoip is enabled', async function () {
      this.timeout(240000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      videoUUID = uuid
      await waitJobs(servers)

      await Promise.all([
        servers[0].kill(),
        servers[1].kill()
      ])

      const config = { geo_ip: { enabled: true } }
      await Promise.all([
        servers[0].run(config),
        servers[1].run(config)
      ])

      await servers[0].views.view({ id: uuid, xForwardedFor: '8.8.8.8,127.0.0.1', currentTime: 1 })
      await servers[1].views.view({ id: uuid, xForwardedFor: '8.8.8.4,127.0.0.1', currentTime: 3 })
      await servers[1].views.view({ id: uuid, xForwardedFor: '80.67.169.12,127.0.0.1', currentTime: 2 })

      await processViewersStats(servers)

      const stats = await servers[0].videoStats.getOverallStats({ videoId: uuid })
      expect(stats.countries).to.have.lengthOf(2)

      expect(stats.countries[0].isoCode).to.equal('US')
      expect(stats.countries[0].viewers).to.equal(2)

      expect(stats.countries[1].isoCode).to.equal('FR')
      expect(stats.countries[1].viewers).to.equal(1)
    })

    it('Should filter countries stats by date', async function () {
      const stats = await servers[0].videoStats.getOverallStats({ videoId: videoUUID, startDate: new Date().toISOString() })
      expect(stats.countries).to.have.lengthOf(0)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
