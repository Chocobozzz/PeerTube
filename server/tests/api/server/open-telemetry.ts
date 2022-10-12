/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectLogContain, expectLogDoesNotContain, MockHTTP } from '@server/tests/shared'
import { HttpStatusCode, VideoPrivacy, VideoResolution } from '@shared/models'
import { cleanupTests, createSingleServer, makeRawRequest, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Open Telemetry', function () {
  let server: PeerTubeServer

  describe('Metrics', function () {
    const metricsUrl = 'http://localhost:9092/metrics'

    it('Should not enable open telemetry metrics', async function () {
      this.timeout(60000)

      server = await createSingleServer(1)

      let hasError = false
      try {
        await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      } catch (err) {
        hasError = err.message.includes('ECONNREFUSED')
      }

      expect(hasError).to.be.true

      await server.kill()
    })

    it('Should enable open telemetry metrics', async function () {
      server = await createSingleServer(1, {
        open_telemetry: {
          metrics: {
            enabled: true
          }
        }
      })

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.contain('peertube_job_queue_total{')
    })

    it('Should have playback metrics', async function () {
      await setAccessTokensToServers([ server ])

      const video = await server.videos.quickUpload({ name: 'video' })

      await server.metrics.addPlaybackMetric({
        metrics: {
          playerMode: 'p2p-media-loader',
          resolution: VideoResolution.H_1080P,
          fps: 30,
          resolutionChanges: 1,
          errors: 2,
          downloadedBytesP2P: 0,
          downloadedBytesHTTP: 0,
          uploadedBytesP2P: 5,
          videoId: video.uuid
        }
      })

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.contain('peertube_playback_http_downloaded_bytes_total{')
    })

    after(async function () {
      await server.kill()
    })
  })

  describe('Tracing', function () {
    let mockHTTP: MockHTTP
    let mockPort: number

    before(async function () {
      mockHTTP = new MockHTTP()
      mockPort = await mockHTTP.initialize()
    })

    it('Should enable open telemetry tracing', async function () {
      server = await createSingleServer(1)

      await expectLogDoesNotContain(server, 'Registering Open Telemetry tracing')

      await server.kill()
    })

    it('Should enable open telemetry metrics', async function () {
      server = await createSingleServer(1, {
        open_telemetry: {
          tracing: {
            enabled: true,
            jaeger_exporter: {
              endpoint: 'http://localhost:' + mockPort
            }
          }
        }
      })

      await expectLogContain(server, 'Registering Open Telemetry tracing')
    })

    it('Should upload a video and correctly works', async function () {
      await setAccessTokensToServers([ server ])

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PUBLIC })

      const video = await server.videos.get({ id: uuid })

      expect(video.name).to.equal('video')
    })

    after(async function () {
      await mockHTTP.terminate()
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
