/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy, VideoResolution } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expectLogContain, expectLogDoesNotContain } from '@tests/shared/checks.js'
import { MockHTTP } from '@tests/shared/mock-servers/mock-http.js'
import { expect } from 'chai'

describe('Open Telemetry', function () {
  let server: PeerTubeServer

  describe('Metrics', function () {
    const metricsUrl = 'http://127.0.0.1:9092/metrics'

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
      this.timeout(120000)

      await server.run({
        open_telemetry: {
          metrics: {
            enabled: true,
            http_request_duration: {
              enabled: true
            }
          }
        }
      })

      // Simulate a HTTP request
      await server.videos.list()

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.contain('peertube_job_queue_total{')
      expect(res.text).to.contain('http_request_duration_ms_bucket{')
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
          p2pPeers: 1,
          bufferStalled: 2,
          p2pEnabled: false,
          videoId: video.uuid
        }
      })

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })

      expect(res.text).to.contain('peertube_playback_http_downloaded_bytes_total{')
      expect(res.text).to.contain('peertube_playback_p2p_peers{')
      expect(res.text).to.contain('p2pEnabled="false"')
    })

    it('Should take the last playback metric', async function () {
      await setAccessTokensToServers([ server ])

      const video = await server.videos.quickUpload({ name: 'video' })

      const metrics = {
        playerMode: 'p2p-media-loader' as 'p2p-media-loader',
        resolution: VideoResolution.H_1080P,
        fps: 30,
        resolutionChanges: 1,
        errors: 2,
        downloadedBytesP2P: 0,
        downloadedBytesHTTP: 0,
        uploadedBytesP2P: 5,
        p2pPeers: 7,
        bufferStalled: 8,
        p2pEnabled: false,
        videoId: video.uuid
      }

      await server.metrics.addPlaybackMetric({ metrics })

      metrics.p2pPeers = 42
      await server.metrics.addPlaybackMetric({ metrics })

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })

      // eslint-disable-next-line max-len
      const label = `{videoOrigin="local",playerMode="p2p-media-loader",resolution="1080",fps="30",p2pEnabled="false",videoUUID="${video.uuid}"}`
      expect(res.text).to.contain(`peertube_playback_p2p_peers${label} 42`)
      expect(res.text).to.not.contain(`peertube_playback_p2p_peers${label} 7`)
    })

    it('Should disable http request duration metrics', async function () {
      await server.kill()

      await server.run({
        open_telemetry: {
          metrics: {
            enabled: true,
            http_request_duration: {
              enabled: false
            }
          }
        }
      })

      // Simulate a HTTP request
      await server.videos.list()

      const res = await makeRawRequest({ url: metricsUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.not.contain('http_request_duration_ms_bucket{')
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
      await server.run({
        open_telemetry: {
          tracing: {
            enabled: true,
            jaeger_exporter: {
              endpoint: 'http://127.0.0.1:' + mockPort
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
