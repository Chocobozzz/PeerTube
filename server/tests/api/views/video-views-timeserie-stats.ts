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
      this.timeout(60000);

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

    function expectTimeserieData (result: VideoStatsTimeserie, lastValue: number) {
      const { data } = result
      expect(data).to.have.lengthOf(30)

      const last = data[data.length - 1]

      const today = new Date().getDate()
      expect(new Date(last.date).getDate()).to.equal(today)
      expect(last.value).to.equal(lastValue)

      for (let i = 0; i < data.length - 2; i++) {
        expect(data[i].value).to.equal(0)
      }
    }

    before(async function () {
      this.timeout(60000);

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

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
