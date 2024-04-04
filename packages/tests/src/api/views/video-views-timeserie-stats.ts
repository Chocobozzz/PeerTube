/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { PeerTubeServer, cleanupTests, stopFfmpeg } from '@peertube/peertube-server-commands'
import { prepareViewsServers, prepareViewsVideos, processViewersStats } from '@tests/shared/views.js'
import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'

function buildOneMonthAgo () {
  const monthAgo = new Date()
  monthAgo.setHours(0, 0, 0, 0)

  monthAgo.setDate(monthAgo.getDate() - 29)

  return monthAgo
}

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
      this.timeout(240000);

      ({ vodVideoId } = await prepareViewsVideos({ servers, live: false, vod: true }))
    })

    it('Should display empty metric stats', async function () {
      for (const metric of availableMetrics) {
        const { data } = await servers[0].videoStats.getTimeserieStats({ videoId: vodVideoId, metric })

        expect(data).to.have.length.at.least(1)

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

    function expectTodayLastValue (result: VideoStatsTimeserie, lastValue?: number) {
      const { data } = result

      const last = data[data.length - 1]
      const today = new Date().getDate()
      expect(new Date(last.date).getDate()).to.equal(today)

      if (lastValue) expect(last.value).to.equal(lastValue)
    }

    function expectTimeserieData (result: VideoStatsTimeserie, lastValue: number) {
      const { data } = result
      expect(data).to.have.length.at.least(25)

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

    function runTests (options: { useSessionId: boolean }) {

      const generateSession = () => {
        if (!options.useSessionId) return undefined

        return buildUUID()
      }

      before(async function () {
        this.timeout(240000);

        ({ vodVideoId, liveVideoId, ffmpegCommand: command } = await prepareViewsVideos({ servers, live: true, vod: true }))
      })

      it('Should display appropriate viewers metrics', async function () {
        for (const videoId of [ vodVideoId, liveVideoId ]) {
          await servers[0].views.simulateViewer({ id: videoId, sessionId: generateSession(), currentTimes: [ 0, 3 ] })
          await servers[1].views.simulateViewer({ id: videoId, sessionId: generateSession(), currentTimes: [ 0, 5 ] })
        }

        await processViewersStats(servers)

        for (const videoId of [ vodVideoId, liveVideoId ]) {
          const result = await servers[0].videoStats.getTimeserieStats({
            videoId,
            startDate: buildOneMonthAgo(),
            endDate: new Date(),
            metric: 'viewers'
          })
          expectTimeserieData(result, 2)
        }
      })

      it('Should display appropriate watch time metrics', async function () {
        for (const videoId of [ vodVideoId, liveVideoId ]) {
          const result = await servers[0].videoStats.getTimeserieStats({
            videoId,
            startDate: buildOneMonthAgo(),
            endDate: new Date(),
            metric: 'aggregateWatchTime'
          })
          expectTimeserieData(result, 8)

          await servers[1].views.simulateViewer({ id: videoId, sessionId: generateSession(), currentTimes: [ 0, 1 ] })
        }

        await processViewersStats(servers)

        for (const videoId of [ vodVideoId, liveVideoId ]) {
          const result = await servers[0].videoStats.getTimeserieStats({
            videoId,
            startDate: buildOneMonthAgo(),
            endDate: new Date(),
            metric: 'aggregateWatchTime'
          })
          expectTimeserieData(result, 9)
        }
      })

      it('Should use a custom start/end date', async function () {
        const now = new Date()
        const twentyDaysAgo = new Date()
        twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 19)

        const result = await servers[0].videoStats.getTimeserieStats({
          videoId: vodVideoId,
          metric: 'aggregateWatchTime',
          startDate: twentyDaysAgo,
          endDate: now
        })

        expect(result.groupInterval).to.equal('1 day')
        expect(result.data).to.have.lengthOf(20)

        const first = result.data[0]
        expect(new Date(first.date).toLocaleDateString()).to.equal(twentyDaysAgo.toLocaleDateString())

        expectInterval(result, 24 * 3600 * 1000)
        expectTodayLastValue(result, 9)
      })

      it('Should automatically group by months', async function () {
        const now = new Date()
        const heightYearsAgo = new Date()
        heightYearsAgo.setFullYear(heightYearsAgo.getFullYear() - 7)

        const result = await servers[0].videoStats.getTimeserieStats({
          videoId: vodVideoId,
          metric: 'aggregateWatchTime',
          startDate: heightYearsAgo,
          endDate: now
        })

        expect(result.groupInterval).to.equal('6 months')
        expect(result.data).to.have.length.above(10).and.below(200)
      })

      it('Should automatically group by days', async function () {
        const now = new Date()
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

        const result = await servers[0].videoStats.getTimeserieStats({
          videoId: vodVideoId,
          metric: 'aggregateWatchTime',
          startDate: threeMonthsAgo,
          endDate: now
        })

        expect(result.groupInterval).to.equal('2 days')
        expect(result.data).to.have.length.above(10).and.below(200)
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

        expect(result.groupInterval).to.equal('1 hour')
        expect(result.data).to.have.length.above(24).and.below(50)

        expectInterval(result, 3600 * 1000)
        expectTodayLastValue(result, 9)
      })

      it('Should automatically group by ten minutes', async function () {
        const now = new Date()
        const twoHoursAgo = new Date()
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 4)

        const result = await servers[0].videoStats.getTimeserieStats({
          videoId: vodVideoId,
          metric: 'aggregateWatchTime',
          startDate: twoHoursAgo,
          endDate: now
        })

        expect(result.groupInterval).to.equal('10 minutes')
        expect(result.data).to.have.length.above(20).and.below(30)

        expectInterval(result, 60 * 10 * 1000)
        expectTodayLastValue(result)
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

        expect(result.groupInterval).to.equal('1 minute')
        expect(result.data).to.have.length.above(20).and.below(40)

        expectInterval(result, 60 * 1000)
        expectTodayLastValue(result)
      })

      after(async function () {
        await stopFfmpeg(command)
      })
    }

    describe('Not using session id', function () {
      runTests({ useSessionId: false })
    })

    describe('Using session id', function () {
      runTests({ useSessionId: true })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
