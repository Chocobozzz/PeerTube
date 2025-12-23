/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PlaybackMetricCreate, VideoResolution } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test metrics API validators', function () {
  let server: PeerTubeServer
  let videoUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1, {
      open_telemetry: {
        metrics: {
          enabled: true
        }
      }
    })

    await setAccessTokensToServers([ server ])

    const { uuid } = await server.videos.quickUpload({ name: 'video' })
    videoUUID = uuid
  })

  describe('When adding playback metrics', function () {
    const path = '/api/v1/metrics/playback'
    let baseParams: PlaybackMetricCreate

    before(function () {
      baseParams = {
        playerMode: 'p2p-media-loader',
        resolution: VideoResolution.H_1080P,
        fps: 30,
        resolutionChanges: 1,
        errors: 2,
        p2pEnabled: true,
        downloadedBytesP2P: 0,
        downloadedBytesHTTP: 0,
        uploadedBytesP2P: 0,
        bufferStalled: 0,
        videoId: videoUUID
      }
    })

    it('Should fail with an invalid resolution', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, resolution: 'toto' }
      })
    })

    it('Should fail with an invalid fps', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, fps: 'toto' }
      })
    })

    it('Should fail with a missing/invalid player mode', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'playerMode' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, playerMode: 'toto' }
      })
    })

    it('Should fail with an missing/invalid resolution changes', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'resolutionChanges' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, resolutionChanges: 'toto' }
      })
    })

    it('Should fail with an missing/invalid errors', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'errors' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, errors: 'toto' }
      })
    })

    it('Should fail with an missing/invalid downloadedBytesP2P', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'downloadedBytesP2P' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, downloadedBytesP2P: 'toto' }
      })
    })

    it('Should fail with an missing/invalid downloadedBytesHTTP', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'downloadedBytesHTTP' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, downloadedBytesHTTP: 'toto' }
      })
    })

    it('Should fail with an missing/invalid uploadedBytesP2P', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'uploadedBytesP2P' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, uploadedBytesP2P: 'toto' }
      })
    })

    it('Should fail with a missing/invalid p2pEnabled', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: omit(baseParams, [ 'p2pEnabled' ])
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, p2pEnabled: 'toto' }
      })
    })

    it('Should fail with an invalid totalPeers', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, p2pPeers: 'toto' }
      })
    })

    it('Should fail with an invalid bufferStalled', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, bufferStalled: 'toto' }
      })
    })

    it('Should fail with a bad video id', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, videoId: 'toto' }
      })
    })

    it('Should fail with an unknown video', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, videoId: 42 },
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: baseParams,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { ...baseParams, p2pEnabled: false, totalPeers: 32 },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
