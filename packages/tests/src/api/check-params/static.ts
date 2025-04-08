/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoDetails, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { basename } from 'path'

describe('Test static endpoints validators', function () {
  let server: PeerTubeServer

  let privateVideo: VideoDetails
  let privateM3U8: string

  let publicVideo: VideoDetails

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await server.config.enableMinimumTranscoding({ hls: true })

    {
      const { uuid } = await server.videos.quickUpload({ name: 'video 1', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ server ])

      privateVideo = await server.videos.getWithToken({ id: uuid })
      privateM3U8 = basename(getHLS(privateVideo).playlistUrl)
    }

    {
      const { uuid } = await server.videos.quickUpload({ name: 'video 2', privacy: VideoPrivacy.PUBLIC })
      await waitJobs([ server ])

      publicVideo = await server.videos.get({ id: uuid })
    }

    await waitJobs([ server ])
  })

  describe('Getting m3u8 playlist', function () {
    it('Should fail with an invalid video UUID', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/static/streaming-playlists/hls/private/toto/' + privateM3U8
      })
    })

    it('Should fail with an invalid playlist name', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/static/streaming-playlists/hls/private/' + privateVideo.uuid + '/' + privateM3U8.replace('.m3u8', '.mp4'),
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with another m3u8 playlist of another video', async function () {
      await makeGetRequest({
        url: server.url,
        headers: {
          'x-peertube-video-password': 'fake'
        },
        path: '/static/streaming-playlists/hls/private/' + publicVideo.uuid + '/..%2f' + privateVideo.uuid + '%2f' + privateM3U8
      })
    })

    it('Should succeed with the correct params', async function () {
      const { text } = await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/static/streaming-playlists/hls/private/' + privateVideo.uuid + '/' + privateM3U8,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(text).to.contain('#EXTM3U')
      expect(text).to.contain(basename(getHLS(privateVideo).files[0].playlistUrl))
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
