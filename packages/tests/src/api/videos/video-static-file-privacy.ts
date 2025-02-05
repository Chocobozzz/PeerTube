/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles, wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType, LiveVideo, VideoDetails, VideoPrivacy, VideoResolution } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  findExternalSavedVideo,
  makeRawRequest,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkVideoFileTokenReinjection } from '@tests/shared/streaming-playlists.js'
import { magnetUriDecode, parseTorrentVideo } from '@tests/shared/p2p.js'
import { expect } from 'chai'

describe('Test video static file privacy', function () {
  let server: PeerTubeServer
  let userToken: string

  before(async function () {
    this.timeout(50000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userToken = await server.users.generateUserAndToken('user1')
  })

  describe('VOD static file path', function () {

    function runSuite () {

      async function checkPrivateFiles (uuid: string) {
        const video = await server.videos.getWithToken({ id: uuid })

        for (const file of video.files) {
          expect(file.fileDownloadUrl).to.not.include('/private/')
          expectStartWith(file.fileUrl, server.url + '/static/web-videos/private/')

          const torrent = await parseTorrentVideo(server, file)
          expect(torrent.urlList).to.have.lengthOf(0)

          const magnet = await magnetUriDecode(file.magnetUri)
          expect(magnet.urlList).to.have.lengthOf(0)

          await makeRawRequest({ url: file.fileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        }

        const hls = video.streamingPlaylists[0]
        if (hls) {
          expectStartWith(hls.playlistUrl, server.url + '/static/streaming-playlists/hls/private/')
          expectStartWith(hls.segmentsSha256Url, server.url + '/static/streaming-playlists/hls/private/')

          await makeRawRequest({ url: hls.playlistUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: hls.segmentsSha256Url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        }
      }

      async function checkPublicFiles (uuid: string) {
        const video = await server.videos.get({ id: uuid })

        for (const file of getAllFiles(video)) {
          expect(file.fileDownloadUrl).to.not.include('/private/')
          expect(file.fileUrl).to.not.include('/private/')

          const torrent = await parseTorrentVideo(server, file)
          expect(torrent.urlList[0]).to.not.include('private')

          const magnet = await magnetUriDecode(file.magnetUri)
          expect(magnet.urlList[0]).to.not.include('private')

          await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: torrent.urlList[0], expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: magnet.urlList[0], expectedStatus: HttpStatusCode.OK_200 })
        }

        const hls = video.streamingPlaylists[0]
        if (hls) {
          expect(hls.playlistUrl).to.not.include('private')
          expect(hls.segmentsSha256Url).to.not.include('private')

          await makeRawRequest({ url: hls.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: hls.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
        }
      }

      it('Should upload a private/internal/password protected video and have a private static path', async function () {
        this.timeout(120000)

        for (const privacy of [ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]) {
          const { uuid } = await server.videos.quickUpload({ name: 'video', privacy })
          await waitJobs([ server ])

          await checkPrivateFiles(uuid)
        }

        const { uuid } = await server.videos.quickUpload({
          name: 'video',
          privacy: VideoPrivacy.PASSWORD_PROTECTED,
          videoPasswords: [ 'my super password' ]
        })
        await waitJobs([ server ])

        await checkPrivateFiles(uuid)
      })

      it('Should upload a public video and update it as private/internal to have a private static path', async function () {
        this.timeout(120000)

        for (const privacy of [ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]) {
          const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PUBLIC })
          await waitJobs([ server ])

          await server.videos.update({ id: uuid, attributes: { privacy } })
          await waitJobs([ server ])

          await checkPrivateFiles(uuid)
        }
      })

      it('Should upload a private video and update it to unlisted to have a public static path', async function () {
        this.timeout(120000)

        const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
        await waitJobs([ server ])

        await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.UNLISTED } })
        await waitJobs([ server ])

        await checkPublicFiles(uuid)
      })

      it('Should upload an internal video and update it to public to have a public static path', async function () {
        this.timeout(120000)

        const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.INTERNAL })
        await waitJobs([ server ])

        await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
        await waitJobs([ server ])

        await checkPublicFiles(uuid)
      })

      it('Should upload an internal video and schedule a public publish', async function () {
        this.timeout(120000)

        const attributes = {
          name: 'video',
          privacy: VideoPrivacy.PRIVATE,
          scheduleUpdate: {
            updateAt: new Date(Date.now() + 1000).toISOString(),
            privacy: VideoPrivacy.PUBLIC
          }
        }

        const { uuid } = await server.videos.upload({ attributes })

        await waitJobs([ server ])
        await wait(1000)
        await server.debug.sendCommand({ body: { command: 'process-update-videos-scheduler' } })

        await waitJobs([ server ])

        await checkPublicFiles(uuid)
      })
    }

    describe('Without transcoding', function () {
      runSuite()
    })

    describe('With transcoding', function () {

      before(async function () {
        await server.config.enableMinimumTranscoding()
      })

      runSuite()
    })
  })

  describe('VOD static file right check', function () {
    let unrelatedFileToken: string

    async function checkVideoFiles (options: {
      id: string
      expectedStatus: HttpStatusCodeType
      token: string
      videoFileToken: string
      videoPassword?: string
    }) {
      const { id, expectedStatus, token, videoFileToken, videoPassword } = options

      const video = await server.videos.getWithToken({ id })

      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.fileUrl, token, expectedStatus })
        await makeRawRequest({ url: file.fileDownloadUrl, token, expectedStatus })

        await makeRawRequest({ url: file.fileUrl, query: { videoFileToken }, expectedStatus })
        await makeRawRequest({ url: file.fileDownloadUrl, query: { videoFileToken }, expectedStatus })

        if (videoPassword) {
          const headers = { 'x-peertube-video-password': videoPassword }
          await makeRawRequest({ url: file.fileUrl, headers, expectedStatus })
          await makeRawRequest({ url: file.fileDownloadUrl, headers, expectedStatus })
        }
      }

      const hls = video.streamingPlaylists[0]
      await makeRawRequest({ url: hls.playlistUrl, token, expectedStatus })
      await makeRawRequest({ url: hls.segmentsSha256Url, token, expectedStatus })

      await makeRawRequest({ url: hls.playlistUrl, query: { videoFileToken }, expectedStatus })
      await makeRawRequest({ url: hls.segmentsSha256Url, query: { videoFileToken }, expectedStatus })

      if (videoPassword) {
        const headers = { 'x-peertube-video-password': videoPassword }
        await makeRawRequest({ url: hls.playlistUrl, token: null, headers, expectedStatus })
        await makeRawRequest({ url: hls.segmentsSha256Url, token: null, headers, expectedStatus })
      }
    }

    before(async function () {
      await server.config.enableMinimumTranscoding()

      const { uuid } = await server.videos.quickUpload({ name: 'another video' })
      unrelatedFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid })
    })

    it('Should not be able to access a private video files without OAuth token and file token', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ server ])

      await checkVideoFiles({ id: uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: null, videoFileToken: null })
    })

    it('Should not be able to access password protected video files without OAuth token, file token and password', async function () {
      this.timeout(120000)
      const videoPassword = 'my super password'

      const { uuid } = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ videoPassword ]
      })
      await waitJobs([ server ])

      await checkVideoFiles({
        id: uuid,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        token: null,
        videoFileToken: null,
        videoPassword: null
      })
    })

    it('Should not be able to access an password video files with incorrect OAuth token, file token and password', async function () {
      this.timeout(120000)
      const videoPassword = 'my super password'

      const { uuid } = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ videoPassword ]
      })
      await waitJobs([ server ])

      await checkVideoFiles({
        id: uuid,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        token: userToken,
        videoFileToken: unrelatedFileToken,
        videoPassword: 'incorrectPassword'
      })
    })

    it('Should not be able to access an private video files without appropriate OAuth token and file token', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      await waitJobs([ server ])

      await checkVideoFiles({
        id: uuid,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        token: userToken,
        videoFileToken: unrelatedFileToken
      })
    })

    it('Should be able to access a private video files with appropriate OAuth token or file token', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid })

      await waitJobs([ server ])

      await checkVideoFiles({ id: uuid, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken, videoFileToken })
    })

    it('Should be able to access a password protected video files with appropriate OAuth token or file token', async function () {
      this.timeout(120000)
      const videoPassword = 'my super password'

      const { uuid } = await server.videos.quickUpload({
        name: 'video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ videoPassword ]
      })

      const videoFileToken = await server.videoToken.getVideoFileToken({ token: null, videoId: uuid, videoPassword })

      await waitJobs([ server ])

      await checkVideoFiles({ id: uuid, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken, videoFileToken, videoPassword })
    })

    it('Should reinject video file token', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })

      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid })
      await waitJobs([ server ])

      {
        const video = await server.videos.getWithToken({ id: uuid })
        const hls = video.streamingPlaylists[0]
        const query = { videoFileToken }
        const { text } = await makeRawRequest({ url: hls.playlistUrl, query, expectedStatus: HttpStatusCode.OK_200 })

        expect(text).to.not.include(videoFileToken)
      }

      {
        await checkVideoFileTokenReinjection({
          server,
          videoUUID: uuid,
          videoFileToken,
          resolutions: [ 240, 720 ],
          isLive: false
        })
      }
    })

    it('Should be able to access a private video of another user with an admin OAuth token or file token', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', token: userToken, privacy: VideoPrivacy.PRIVATE })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid })

      await waitJobs([ server ])

      await checkVideoFiles({ id: uuid, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken, videoFileToken })
    })
  })

  describe('Live static file path and check', function () {
    let normalLiveId: string
    let normalLive: LiveVideo

    let permanentLiveId: string
    let permanentLive: LiveVideo

    let passwordProtectedLiveId: string
    let passwordProtectedLive: LiveVideo

    const correctPassword = 'my super password'

    let unrelatedFileToken: string

    async function checkLiveFiles (options: { live: LiveVideo, liveId: string, videoPassword?: string }) {
      const { live, liveId, videoPassword } = options
      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await server.live.waitUntilPublished({ videoId: liveId })

      const video = await server.videos.getWithToken({ id: liveId })

      const fileToken = await server.videoToken.getVideoFileToken({ videoId: video.uuid })

      const hls = video.streamingPlaylists[0]

      for (const url of [ hls.playlistUrl, hls.segmentsSha256Url ]) {
        expectStartWith(url, server.url + '/static/streaming-playlists/hls/private/')

        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url, query: { videoFileToken: fileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: unrelatedFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })

        if (videoPassword) {
          await makeRawRequest({ url, headers: { 'x-peertube-video-password': videoPassword }, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({
            url,
            headers: { 'x-peertube-video-password': 'incorrectPassword' },
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        }

      }

      await stopFfmpeg(ffmpegCommand)
    }

    async function checkReplay (replay: VideoDetails) {
      const fileToken = await server.videoToken.getVideoFileToken({ videoId: replay.uuid })

      const hls = replay.streamingPlaylists[0]
      expect(hls.files).to.not.have.lengthOf(0)

      for (const file of hls.files) {
        await makeRawRequest({ url: file.fileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url: file.fileUrl, query: { videoFileToken: fileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url: file.fileUrl, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({
          url: file.fileUrl,
          query: { videoFileToken: unrelatedFileToken },
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }

      for (const url of [ hls.playlistUrl, hls.segmentsSha256Url ]) {
        expectStartWith(url, server.url + '/static/streaming-playlists/hls/private/')

        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url, query: { videoFileToken: fileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: unrelatedFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    }

    before(async function () {
      await server.config.enableMinimumTranscoding()

      const { uuid } = await server.videos.quickUpload({ name: 'another video' })
      unrelatedFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid })

      await server.config.enableLive({
        allowReplay: true,
        transcoding: true,
        resolutions: 'min'
      })

      {
        const { video, live } = await server.live.quickCreate({
          saveReplay: true,
          permanentLive: false,
          privacy: VideoPrivacy.PRIVATE
        })
        normalLiveId = video.uuid
        normalLive = live
      }

      {
        const { video, live } = await server.live.quickCreate({
          saveReplay: true,
          permanentLive: true,
          privacy: VideoPrivacy.PRIVATE
        })
        permanentLiveId = video.uuid
        permanentLive = live
      }

      {
        const { video, live } = await server.live.quickCreate({
          saveReplay: false,
          permanentLive: false,
          privacy: VideoPrivacy.PASSWORD_PROTECTED,
          videoPasswords: [ correctPassword ]
        })
        passwordProtectedLiveId = video.uuid
        passwordProtectedLive = live
      }
    })

    it('Should create a private normal live and have a private static path', async function () {
      this.timeout(240000)

      await checkLiveFiles({ live: normalLive, liveId: normalLiveId })
    })

    it('Should create a private permanent live and have a private static path', async function () {
      this.timeout(240000)

      await checkLiveFiles({ live: permanentLive, liveId: permanentLiveId })
    })

    it('Should create a password protected live and have a private static path', async function () {
      this.timeout(240000)

      await checkLiveFiles({ live: passwordProtectedLive, liveId: passwordProtectedLiveId, videoPassword: correctPassword })
    })

    it('Should reinject video file token on permanent live', async function () {
      this.timeout(240000)

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: permanentLive.rtmpUrl, streamKey: permanentLive.streamKey })
      await server.live.waitUntilPublished({ videoId: permanentLiveId })

      const video = await server.videos.getWithToken({ id: permanentLiveId })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: video.uuid })
      const hls = video.streamingPlaylists[0]

      {
        const query = { videoFileToken }
        const { text } = await makeRawRequest({ url: hls.playlistUrl, query, expectedStatus: HttpStatusCode.OK_200 })

        expect(text).to.not.include(videoFileToken)
      }

      {
        await checkVideoFileTokenReinjection({
          server,
          videoUUID: permanentLiveId,
          videoFileToken,
          resolutions: [ VideoResolution.H_720P, VideoResolution.H_240P ],
          isLive: true
        })
      }

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should have created a replay of the normal live with a private static path', async function () {
      this.timeout(240000)

      await server.live.waitUntilReplacedByReplay({ videoId: normalLiveId })

      const replay = await server.videos.getWithToken({ id: normalLiveId })
      await checkReplay(replay)
    })

    it('Should have created a replay of the permanent live with a private static path', async function () {
      this.timeout(240000)

      await server.live.waitUntilWaiting({ videoId: permanentLiveId })
      await waitJobs([ server ])

      const replayFromList = await findExternalSavedVideo(server, permanentLiveId)
      const replay = await server.videos.getWithToken({ id: replayFromList.id })

      await checkReplay(replay)
    })
  })

  describe('With static file right check disabled', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(240000)

      await server.kill()

      await server.run({
        static_files: {
          private_files_require_auth: false
        }
      })

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.INTERNAL })
      videoUUID = uuid

      await waitJobs([ server ])
    })

    it('Should not check auth for private static files', async function () {
      const video = await server.videos.getWithToken({ id: videoUUID })

      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const hls = video.streamingPlaylists[0]
      await makeRawRequest({ url: hls.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: hls.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
