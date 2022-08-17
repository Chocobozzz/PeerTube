/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { prepareViewsServers, prepareViewsVideos, processViewsBuffer } from '@server/tests/shared'
import { wait } from '@shared/core-utils'
import { cleanupTests, PeerTubeServer, stopFfmpeg, waitJobs } from '@shared/server-commands'

describe('Test video views/viewers counters', function () {
  let servers: PeerTubeServer[]

  async function checkCounter (field: 'views' | 'viewers', id: string, expected: number) {
    for (const server of servers) {
      const video = await server.videos.get({ id })

      const messageSuffix = video.isLive
        ? 'live video'
        : 'vod video'

      expect(video[field]).to.equal(expected, `${field} not valid on server ${server.serverNumber} for ${messageSuffix} ${video.uuid}`)
    }
  }

  before(async function () {
    this.timeout(120000)

    servers = await prepareViewsServers()
  })

  describe('Test views counter on VOD', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should not view a video if watch time is below the threshold', async function () {
      await servers[0].views.simulateViewer({ id: videoUUID, currentTimes: [ 1, 2 ] })
      await processViewsBuffer(servers)

      await checkCounter('views', videoUUID, 0)
    })

    it('Should view a video if watch time is above the threshold', async function () {
      await servers[0].views.simulateViewer({ id: videoUUID, currentTimes: [ 1, 4 ] })
      await processViewsBuffer(servers)

      await checkCounter('views', videoUUID, 1)
    })

    it('Should not view again this video with the same IP', async function () {
      await servers[0].views.simulateViewer({ id: videoUUID, xForwardedFor: '0.0.0.1,127.0.0.1', currentTimes: [ 1, 4 ] })
      await servers[0].views.simulateViewer({ id: videoUUID, xForwardedFor: '0.0.0.1,127.0.0.1', currentTimes: [ 1, 4 ] })
      await processViewsBuffer(servers)

      await checkCounter('views', videoUUID, 2)
    })

    it('Should view the video from server 2 and send the event', async function () {
      await servers[1].views.simulateViewer({ id: videoUUID, currentTimes: [ 1, 4 ] })
      await waitJobs(servers)
      await processViewsBuffer(servers)

      await checkCounter('views', videoUUID, 3)
    })
  })

  describe('Test views and viewers counters on live and VOD', function () {
    let liveVideoId: string
    let vodVideoId: string
    let command: FfmpegCommand

    before(async function () {
      this.timeout(120000);

      ({ vodVideoId, liveVideoId, ffmpegCommand: command } = await prepareViewsVideos({ servers, live: true, vod: true }))
    })

    it('Should display no views and viewers', async function () {
      await checkCounter('views', liveVideoId, 0)
      await checkCounter('viewers', liveVideoId, 0)

      await checkCounter('views', vodVideoId, 0)
      await checkCounter('viewers', vodVideoId, 0)
    })

    it('Should view twice and display 1 view/viewer', async function () {
      this.timeout(30000)

      await servers[0].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35 ] })
      await servers[0].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35 ] })
      await servers[0].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })
      await servers[0].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })

      await waitJobs(servers)
      await checkCounter('viewers', liveVideoId, 1)
      await checkCounter('viewers', vodVideoId, 1)

      await processViewsBuffer(servers)

      await checkCounter('views', liveVideoId, 1)
      await checkCounter('views', vodVideoId, 1)
    })

    it('Should wait and display 0 viewers but still have 1 view', async function () {
      this.timeout(30000)

      await wait(12000)
      await waitJobs(servers)

      await checkCounter('views', liveVideoId, 1)
      await checkCounter('viewers', liveVideoId, 0)

      await checkCounter('views', vodVideoId, 1)
      await checkCounter('viewers', vodVideoId, 0)
    })

    it('Should view on a remote and on local and display 2 viewers and 3 views', async function () {
      this.timeout(30000)

      await servers[0].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })
      await servers[1].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })
      await servers[1].views.simulateViewer({ id: vodVideoId, currentTimes: [ 0, 5 ] })

      await servers[0].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35 ] })
      await servers[1].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35 ] })
      await servers[1].views.simulateViewer({ id: liveVideoId, currentTimes: [ 0, 35 ] })

      await waitJobs(servers)

      await checkCounter('viewers', liveVideoId, 2)
      await checkCounter('viewers', vodVideoId, 2)

      await processViewsBuffer(servers)

      await checkCounter('views', liveVideoId, 3)
      await checkCounter('views', vodVideoId, 3)
    })

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
