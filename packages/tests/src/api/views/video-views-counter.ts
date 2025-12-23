/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import { PeerTubeServer, cleanupTests, stopFfmpeg, waitJobs } from '@peertube/peertube-server-commands'
import { prepareViewsServers, prepareViewsVideos, processViewsBuffer } from '@tests/shared/views.js'
import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'

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

  function runTests (options: { useSessionId: boolean }) {

    const generateSession = () => {
      if (!options.useSessionId) return undefined

      return buildUUID()
    }

    describe('Test views counter on VOD', function () {
      let videoUUID: string

      before(async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
        videoUUID = uuid

        await waitJobs(servers)
      })

      it('Should not view a video if watch time is below the threshold', async function () {
        await servers[0].views.simulateViewer({ id: videoUUID, sessionId: generateSession(), currentTimes: [ 1, 2 ] })
        await processViewsBuffer(servers)

        await checkCounter('views', videoUUID, 0)
      })

      it('Should view a video if watch time is above the threshold', async function () {
        await servers[0].views.simulateViewer({ id: videoUUID, sessionId: generateSession(), currentTimes: [ 1, 4 ] })
        await processViewsBuffer(servers)

        await checkCounter('views', videoUUID, 1)
      })

      it('Should not view again this video with the same IP/session Id', async function () {
        const sessionId = generateSession()
        const xForwardedFor = '0.0.0.1,127.0.0.1'

        await servers[0].views.simulateViewer({ id: videoUUID, sessionId, xForwardedFor, currentTimes: [ 1, 4 ] })
        await servers[0].views.simulateViewer({ id: videoUUID, sessionId, xForwardedFor, currentTimes: [ 1, 4 ] })
        await processViewsBuffer(servers)

        await checkCounter('views', videoUUID, 2)
      })

      it('Should view the video from server 2 and send the event', async function () {
        const sessionId = generateSession()

        await servers[1].views.simulateViewer({ id: videoUUID, sessionId, currentTimes: [ 1, 4 ] })

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
        this.timeout(240000);

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

        const sessionId = generateSession()

        for (let i = 0; i < 3; i++) {
          await servers[0].views.simulateViewer({ id: liveVideoId, sessionId, currentTimes: [ 0, 35 ] })
          await servers[0].views.simulateViewer({ id: liveVideoId, sessionId, currentTimes: [ 0, 35 ] })
          await servers[0].views.simulateViewer({ id: vodVideoId, sessionId, currentTimes: [ 0, 5 ] })
          await servers[0].views.simulateViewer({ id: vodVideoId, sessionId, currentTimes: [ 0, 5 ] })
        }

        let doWhile = true
        while (doWhile) {
          try {
            await checkCounter('viewers', liveVideoId, 1)
            await checkCounter('viewers', vodVideoId, 1)

            doWhile = false
          } catch {
            await wait(1000)

            doWhile = true
          }
        }

        await processViewsBuffer(servers)

        await checkCounter('views', liveVideoId, 1)
        await checkCounter('views', vodVideoId, 1)
      })

      it('Should wait and display 0 viewers but still have 1 view', async function () {
        this.timeout(45000)

        let error = false

        do {
          try {
            await checkCounter('views', liveVideoId, 1)
            await checkCounter('viewers', liveVideoId, 0)

            await checkCounter('views', vodVideoId, 1)
            await checkCounter('viewers', vodVideoId, 0)

            error = false
            await wait(1000)
          } catch {
            error = true
          }
        } while (error)
      })

      it('Should view on a remote and on local and display appropriate views/viewers', async function () {
        this.timeout(30000)

        const xForwardedFor = '0.0.0.1,127.0.0.1'
        const sessionId = generateSession()
        const xForwardedFor2 = '0.0.0.2,127.0.0.1'
        const sessionId2 = generateSession()

        {
          const currentTimes = [ 0, 5 ]

          await servers[0].views.simulateViewer({ id: vodVideoId, xForwardedFor, sessionId, currentTimes })
          await servers[0].views.simulateViewer({ id: vodVideoId, xForwardedFor, sessionId, currentTimes })
          await servers[0].views.simulateViewer({ id: vodVideoId, xForwardedFor: xForwardedFor2, sessionId: sessionId2, currentTimes })
          await servers[1].views.simulateViewer({ id: vodVideoId, xForwardedFor, sessionId, currentTimes })
          await servers[1].views.simulateViewer({ id: vodVideoId, xForwardedFor, sessionId, currentTimes })
        }

        {
          const currentTimes = [ 0, 35 ]

          await servers[0].views.simulateViewer({ id: liveVideoId, xForwardedFor: xForwardedFor2, sessionId: sessionId2, currentTimes })
          await servers[1].views.simulateViewer({ id: liveVideoId, xForwardedFor, sessionId, currentTimes })
          await servers[1].views.simulateViewer({ id: liveVideoId, xForwardedFor, sessionId, currentTimes })
        }

        let doWhile = true
        while (doWhile) {
          try {
            await checkCounter('viewers', liveVideoId, 2)
            await checkCounter('viewers', vodVideoId, 3)

            doWhile = false
          } catch {
            await wait(1000)

            doWhile = true
          }
        }

        await processViewsBuffer(servers)

        await checkCounter('views', liveVideoId, 3)
        await checkCounter('views', vodVideoId, 4)
      })

      after(async function () {
        await stopFfmpeg(command)
      })
    })
  }

  describe('Federation', function () {

    before(async function () {
      this.timeout(120000)

      servers = await prepareViewsServers({ viewExpiration: '5 seconds' })
    })

    describe('Not using session id', function () {
      runTests({ useSessionId: false })
    })

    describe('Using session id', function () {
      runTests({ useSessionId: true })
    })

    describe('View minimum duration config', function () {

      it('Should update "count_view_after" config', async function () {
        this.timeout(120000)

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })

        {
          await servers[0].views.simulateViewer({ id: uuid, sessionId: buildUUID(), currentTimes: [ 1, 2 ] })
          await processViewsBuffer(servers)

          await checkCounter('views', uuid, 0)
        }

        await servers[0].kill()
        await servers[0].run({ views: { videos: { count_view_after: '1 second' } } })

        {
          await servers[0].views.simulateViewer({ id: uuid, sessionId: buildUUID(), currentTimes: [ 1, 2 ] })
          await processViewsBuffer(servers)

          await checkCounter('views', uuid, 1)
        }
      })
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('Disabling session id trusting', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(120000)

      servers = await prepareViewsServers({ viewExpiration: '5 seconds', trustViewerSessionId: false });

      ({ uuid: videoUUID } = await servers[0].videos.quickUpload({ name: 'video' }))
      await waitJobs(servers)
    })

    it('Should not take into account session id if the server does not trust it', async function () {
      await servers[0].views.simulateViewer({ id: videoUUID, sessionId: buildUUID(), currentTimes: [ 1, 4 ] })
      await servers[0].views.simulateViewer({ id: videoUUID, sessionId: buildUUID(), currentTimes: [ 1, 4 ] })

      await processViewsBuffer(servers)
      await checkCounter('views', videoUUID, 1)

      const xForwardedFor = '0.0.0.1,127.0.0.1'
      await servers[0].views.simulateViewer({ id: videoUUID, xForwardedFor, sessionId: buildUUID(), currentTimes: [ 1, 4 ] })

      await processViewsBuffer(servers)
      await checkCounter('views', videoUUID, 2)
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

})
