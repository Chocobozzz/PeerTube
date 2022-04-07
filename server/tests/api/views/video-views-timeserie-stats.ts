/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { prepareViewsServers, prepareViewsVideos, processViewersStats } from '@server/tests/shared'
import { VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@shared/models'
import { cleanupTests, PeerTubeServer, stopFfmpeg } from '@shared/server-commands'

const expect = chai.expect

describe('Test views timeserie stats', function () {
  const availableMetrics: VideoStatsTimeserieMetric[] = [ 'viewers' ]

  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await prepareViewsServers()
  })

  describe('Common metric tests', function () {
    let vodVideoId: string

    before(async function () {
      this.timeout(120000);

      ({ vodVideoId } = await prepareViewsVideos({ servers, live: false, vod: true }))
    })

    it('Should display empty metric stats', async function () {
      for (const metric of availableMetrics) {
        const { data } = await servers[0].videoStats.getTimeserieStats({ videoId: vodVideoId, metric })

        expect(data).to.have.lengthOf(30)

        for (const d of data) {
          expect(d.value).to.equal(0)
        }
      }
    })
  })

  describe('Test viewer and watch time metrics on live and VOD', function () {
    let vodVideoId: string
    let liveVideoId: string
    let command: FfmpegCommand

    function expectTodayLastValue (result: VideoStatsTimeserie, lastValue: number) {
      const { data } = result

      const last = data[data.length - 1]
      const today = new Date().getDate()
      expect(new Date(last.date).getDate()).to.equal(today)
    }

    function expectTimeserieData (result: VideoStatsTimeserie, lastValue: number) {
      const { data } = result
      expect(data).to.have.lengthOf(30)

      expectTodayLastValue(result, lastValue)

      for (let i = 0; i < data.length - 2; i++) {
        expect(data[i].value).to.equal(0)
      }
    }

    function expectInterval (result: VideoStatsTimeserie, intervalMs: number) {
      const first = result.data[0]
      const second = result.data[1]
      expect(new Date(second.date).getTime() - new Date(first.date).getTime()).to.equal(intervalMs)
    }

    before(async function () {
      this.timeout(120000);

      ({ vodVideoId, liveVideoId, ffmpegCommand: command } = await prepareViewsVideos({ servers, live: true, vod: true }))
    })

    it('Should display appropriate viewers metrics', async function () {
      for (const videoId of [ vodVideoId, liveVideoId ]) {
        await servers[0].views.simulateViewer({ id: videoId, currentTimes: [ 0, 3 ] })
        await servers[1].views.simulateViewer({ id: videoId, currentTimes: [ 0, 5 ] })
      }

      await processViewersStats(servers)

      for (const videoId of [ vodVideoId, liveVideoId ]) {
        const result = await servers[0].videoStats.getTimeserieStats({ videoId, metric: 'viewers' })
        expectTimeserieData(result, 2)
      }
    })

    it('Should display appropriate watch time metrics', async function () {
      for (const videoId of [ vodVideoId, liveVideoId ]) {
        const result = await servers[0].videoStats.getTimeserieStats({ videoId, metric: 'aggregateWatchTime' })
        expectTimeserieData(result, 8)

        await servers[1].views.simulateViewer({ id: videoId, currentTimes: [ 0, 1 ] })
      }

      await processViewersStats(servers)

      for (const videoId of [ vodVideoId, liveVideoId ]) {
        const result = await servers[0].videoStats.getTimeserieStats({ videoId, metric: 'aggregateWatchTime' })
        expectTimeserieData(result, 9)
      }
    })

    it('Should use a custom start/end date', async function () {
      const now = new Date()
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 9)

      const result = await servers[0].videoStats.getTimeserieStats({
        videoId: vodVideoId,
        metric: 'aggregateWatchTime',
        startDate: tenDaysAgo,
        endDate: now
      })

      expect(result.groupInterval).to.equal('one_day')
      expect(result.data).to.have.lengthOf(10)

      const first = result.data[0]
      expect(new Date(first.date).toLocaleDateString()).to.equal(tenDaysAgo.toLocaleDateString())

      expectInterval(result, 24 * 3600 * 1000)
      expectTodayLastValue(result, 9)
    })

    it('Should automatically group by hours', async function () {
      const now = new Date()
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 1)

      const result = await servers[0].videoStats.getTimeserieStats({
        videoId: vodVideoId,
        metric: 'aggregateWatchTime',
        startDate: twoDaysAgo,
        endDate: now
      })

      expect(result.groupInterval).to.equal('one_hour')
      expect(result.data).to.have.length.above(24).and.below(50)

      expectInterval(result, 3600 * 1000)
      expectTodayLastValue(result, 9)
    })

    it('Should automatically group by ten minutes', async function () {
      const now = new Date()
      const twoHoursAgo = new Date()
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 1)

      const result = await servers[0].videoStats.getTimeserieStats({
        videoId: vodVideoId,
        metric: 'aggregateWatchTime',
        startDate: twoHoursAgo,
        endDate: now
      })

      expect(result.groupInterval).to.equal('ten_minutes')
      expect(result.data).to.have.length.above(6).and.below(18)

      expectInterval(result, 60 * 10 * 1000)
      expectTodayLastValue(result, 9)
    })

    it('Should automatically group by one minute', async function () {
      const now = new Date()
      const thirtyAgo = new Date()
      thirtyAgo.setMinutes(thirtyAgo.getMinutes() - 30)

      const result = await servers[0].videoStats.getTimeserieStats({
        videoId: vodVideoId,
        metric: 'aggregateWatchTime',
        startDate: thirtyAgo,
        endDate: now
      })

      expect(result.groupInterval).to.equal('one_minute')
      expect(result.data).to.have.length.above(20).and.below(40)

      expectInterval(result, 60 * 1000)
      expectTodayLastValue(result, 9)
    })

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
