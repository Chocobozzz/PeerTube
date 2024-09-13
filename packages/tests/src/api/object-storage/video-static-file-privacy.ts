/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, LiveVideo, VideoDetails, VideoPrivacy, VideoResolution } from '@peertube/peertube-models'
import { areScalewayObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  findExternalSavedVideo,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { checkPlaylistInfohash, checkVideoFileTokenReinjection } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'
import { basename } from 'path'

function extractFilenameFromUrl (url: string) {
  const parts = basename(url).split(':')

  return parts[parts.length - 1]
}

describe('Object storage for video static file privacy', function () {
  // We need real world object storage to check ACL
  if (areScalewayObjectStorageTestsDisabled()) return

  let server: PeerTubeServer
  let sqlCommand: SQLCommand
  let userToken: string

  // ---------------------------------------------------------------------------

  async function checkPrivateVODFiles (uuid: string) {
    const video = await server.videos.getWithToken({ id: uuid })

    for (const file of video.files) {
      expectStartWith(file.fileUrl, server.url + '/object-storage-proxy/web-videos/private/')

      await makeRawRequest({ url: file.fileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    }

    for (const file of getAllFiles(video)) {
      const internalFileUrl = await sqlCommand.getInternalFileUrl(file.id)
      expectStartWith(internalFileUrl, ObjectStorageCommand.getScalewayBaseUrl())

      const { text } = await makeRawRequest({
        url: internalFileUrl,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
      expect(text).to.contain('AccessDenied')
    }

    const hls = getHLS(video)

    if (hls) {
      for (const url of [ hls.playlistUrl, hls.segmentsSha256Url ]) {
        expectStartWith(url, server.url + '/object-storage-proxy/streaming-playlists/hls/private/')
      }

      await makeRawRequest({ url: hls.playlistUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: hls.segmentsSha256Url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

      for (const file of hls.files) {
        expectStartWith(file.fileUrl, server.url + '/object-storage-proxy/streaming-playlists/hls/private/')

        await makeRawRequest({ url: file.fileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      }

      await checkPlaylistInfohash({ video, files: hls.files, sqlCommand })
    }
  }

  async function checkPublicVODFiles (uuid: string) {
    const video = await server.videos.getWithToken({ id: uuid })

    for (const file of getAllFiles(video)) {
      expectStartWith(file.fileUrl, ObjectStorageCommand.getScalewayBaseUrl())

      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    const hls = getHLS(video)

    if (hls) {
      expectStartWith(hls.playlistUrl, ObjectStorageCommand.getScalewayBaseUrl())
      expectStartWith(hls.segmentsSha256Url, ObjectStorageCommand.getScalewayBaseUrl())

      await makeRawRequest({ url: hls.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: hls.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  // ---------------------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1, ObjectStorageCommand.getDefaultScalewayConfig({ serverNumber: 1 }))
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableMinimumTranscoding()

    userToken = await server.users.generateUserAndToken('user1')

    sqlCommand = new SQLCommand(server)
  })

  describe('VOD', function () {
    let privateVideoUUID: string
    let publicVideoUUID: string
    let passwordProtectedVideoUUID: string
    let userPrivateVideoUUID: string

    const correctPassword = 'my super password'
    const correctPasswordHeader = { 'x-peertube-video-password': correctPassword }
    const incorrectPasswordHeader = { 'x-peertube-video-password': correctPassword + 'toto' }

    // ---------------------------------------------------------------------------

    async function getSampleFileUrls (videoId: string) {
      const video = await server.videos.getWithToken({ id: videoId })

      return {
        webVideoFile: video.files[0].fileUrl,
        hlsFile: getHLS(video).files[0].fileUrl
      }
    }

    // ---------------------------------------------------------------------------

    it('Should upload a private video and have appropriate object storage ACL', async function () {
      this.timeout(120000)

      {
        const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
        privateVideoUUID = uuid
      }

      {
        const { uuid } = await server.videos.quickUpload({ name: 'user video', token: userToken, privacy: VideoPrivacy.PRIVATE })
        userPrivateVideoUUID = uuid
      }

      await waitJobs([ server ])

      await checkPrivateVODFiles(privateVideoUUID)
    })

    it('Should upload a password protected video and have appropriate object storage ACL', async function () {
      this.timeout(120000)

      {
        const { uuid } = await server.videos.quickUpload({
          name: 'video',
          privacy: VideoPrivacy.PASSWORD_PROTECTED,
          videoPasswords: [ correctPassword ]
        })
        passwordProtectedVideoUUID = uuid
      }
      await waitJobs([ server ])

      await checkPrivateVODFiles(passwordProtectedVideoUUID)
    })

    it('Should upload a public video and have appropriate object storage ACL', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.UNLISTED })
      await waitJobs([ server ])

      publicVideoUUID = uuid

      await checkPublicVODFiles(publicVideoUUID)
    })

    it('Should not get files without appropriate OAuth token', async function () {
      this.timeout(60000)

      const { webVideoFile, hlsFile } = await getSampleFileUrls(privateVideoUUID)

      await makeRawRequest({ url: webVideoFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({ url: webVideoFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

      await makeRawRequest({ url: hlsFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({ url: hlsFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should not get files without appropriate password or appropriate OAuth token', async function () {
      this.timeout(60000)

      const { webVideoFile, hlsFile } = await getSampleFileUrls(passwordProtectedVideoUUID)

      await makeRawRequest({ url: webVideoFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({
        url: webVideoFile,
        token: null,
        headers: incorrectPasswordHeader,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
      await makeRawRequest({ url: webVideoFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({
        url: webVideoFile,
        token: null,
        headers: correctPasswordHeader,
        expectedStatus: HttpStatusCode.OK_200
      })

      await makeRawRequest({ url: hlsFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({
        url: hlsFile,
        token: null,
        headers: incorrectPasswordHeader,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
      await makeRawRequest({ url: hlsFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({
        url: hlsFile,
        token: null,
        headers: correctPasswordHeader,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should not get HLS file of another video', async function () {
      this.timeout(60000)

      const privateVideo = await server.videos.getWithToken({ id: privateVideoUUID })
      const hlsFilename = basename(getHLS(privateVideo).files[0].fileUrl)

      const badUrl = server.url + '/object-storage-proxy/streaming-playlists/hls/private/' + userPrivateVideoUUID + '/' + hlsFilename
      const goodUrl = server.url + '/object-storage-proxy/streaming-playlists/hls/private/' + privateVideoUUID + '/' + hlsFilename

      await makeRawRequest({ url: badUrl, token: server.accessToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await makeRawRequest({ url: goodUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should correctly check OAuth, video file token of private video', async function () {
      this.timeout(60000)

      const badVideoFileToken = await server.videoToken.getVideoFileToken({ token: userToken, videoId: userPrivateVideoUUID })
      const goodVideoFileToken = await server.videoToken.getVideoFileToken({ videoId: privateVideoUUID })

      const { webVideoFile, hlsFile } = await getSampleFileUrls(privateVideoUUID)

      for (const url of [ webVideoFile, hlsFile ]) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, query: { videoFileToken: badVideoFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: goodVideoFileToken }, expectedStatus: HttpStatusCode.OK_200 })

      }
    })

    it('Should correctly check OAuth, video file token or video password of password protected video', async function () {
      this.timeout(60000)

      const badVideoFileToken = await server.videoToken.getVideoFileToken({ token: userToken, videoId: userPrivateVideoUUID })
      const goodVideoFileToken = await server.videoToken.getVideoFileToken({
        videoId: passwordProtectedVideoUUID,
        videoPassword: correctPassword
      })

      const { webVideoFile, hlsFile } = await getSampleFileUrls(passwordProtectedVideoUUID)

      for (const url of [ hlsFile, webVideoFile ]) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, query: { videoFileToken: badVideoFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: goodVideoFileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({
          url,
          headers: incorrectPasswordHeader,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
        await makeRawRequest({ url, headers: correctPasswordHeader, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should reinject video file token', async function () {
      this.timeout(120000)

      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: privateVideoUUID })

      await checkVideoFileTokenReinjection({
        server,
        videoUUID: privateVideoUUID,
        videoFileToken,
        resolutions: [ VideoResolution.H_720P, VideoResolution.H_240P ],
        isLive: false
      })
    })

    it('Should update public video to private', async function () {
      this.timeout(60000)

      await server.videos.update({ id: publicVideoUUID, attributes: { privacy: VideoPrivacy.INTERNAL } })

      await checkPrivateVODFiles(publicVideoUUID)
    })

    it('Should update private video to public', async function () {
      this.timeout(60000)

      await server.videos.update({ id: publicVideoUUID, attributes: { privacy: VideoPrivacy.PUBLIC } })

      await checkPublicVODFiles(publicVideoUUID)
    })
  })

  describe('Live', function () {
    let normalLiveId: string
    let normalLive: LiveVideo

    let permanentLiveId: string
    let permanentLive: LiveVideo

    let passwordProtectedLiveId: string
    let passwordProtectedLive: LiveVideo

    const correctPassword = 'my super password'

    let unrelatedFileToken: string

    // ---------------------------------------------------------------------------

    async function checkLiveFiles (live: LiveVideo, liveId: string, videoPassword?: string) {
      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await server.live.waitUntilPublished({ videoId: liveId })

      const video = videoPassword
        ? await server.videos.getWithPassword({ id: liveId, password: videoPassword })
        : await server.videos.getWithToken({ id: liveId })

      const fileToken = videoPassword
        ? await server.videoToken.getVideoFileToken({ token: null, videoId: video.uuid, videoPassword })
        : await server.videoToken.getVideoFileToken({ videoId: video.uuid })

      const hls = video.streamingPlaylists[0]

      for (const url of [ hls.playlistUrl, hls.segmentsSha256Url ]) {
        expectStartWith(url, server.url + '/object-storage-proxy/streaming-playlists/hls/private/')

        await makeRawRequest({ url: hls.playlistUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url: hls.segmentsSha256Url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url, query: { videoFileToken: fileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: unrelatedFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })

        if (videoPassword) {
          await makeRawRequest({
            url,
            headers: { 'x-peertube-video-password': videoPassword },
            expectedStatus: HttpStatusCode.OK_200
          })

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
        expectStartWith(url, server.url + '/object-storage-proxy/streaming-playlists/hls/private/')

        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url, query: { videoFileToken: fileToken }, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: unrelatedFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    }

    // ---------------------------------------------------------------------------

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

      await checkLiveFiles(normalLive, normalLiveId)
    })

    it('Should create a private permanent live and have a private static path', async function () {
      this.timeout(240000)

      await checkLiveFiles(permanentLive, permanentLiveId)
    })

    it('Should create a password protected live and have a private static path', async function () {
      this.timeout(240000)

      await checkLiveFiles(passwordProtectedLive, passwordProtectedLiveId, correctPassword)
    })

    it('Should reinject video file token in permanent live', async function () {
      this.timeout(240000)

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: permanentLive.rtmpUrl, streamKey: permanentLive.streamKey })
      await server.live.waitUntilPublished({ videoId: permanentLiveId })

      const video = await server.videos.getWithToken({ id: permanentLiveId })
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: video.uuid })

      await checkVideoFileTokenReinjection({
        server,
        videoUUID: permanentLiveId,
        videoFileToken,
        resolutions: [ VideoResolution.H_720P, VideoResolution.H_240P ],
        isLive: true
      })

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

  describe('With private files proxy disabled and public ACL for private files', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(240000)

      await server.kill()

      const config = ObjectStorageCommand.getDefaultScalewayConfig({
        serverNumber: 1,
        enablePrivateProxy: false,
        privateACL: 'public-read'
      })
      await server.run(config)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      videoUUID = uuid

      await waitJobs([ server ])
    })

    it('Should display object storage path for a private video and be able to access them', async function () {
      this.timeout(60000)

      await checkPublicVODFiles(videoUUID)
    })

    it('Should not be able to access object storage proxy', async function () {
      const privateVideo = await server.videos.getWithToken({ id: videoUUID })
      const webVideoFilename = extractFilenameFromUrl(privateVideo.files[0].fileUrl)
      const hlsFilename = extractFilenameFromUrl(getHLS(privateVideo).files[0].fileUrl)

      await makeRawRequest({
        url: server.url + '/object-storage-proxy/web-videos/private/' + webVideoFilename,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeRawRequest({
        url: server.url + '/object-storage-proxy/streaming-playlists/hls/private/' + videoUUID + '/' + hlsFilename,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  after(async function () {
    this.timeout(240000)

    const { data } = await server.videos.listAllForAdmin()

    for (const v of data) {
      await server.videos.remove({ id: v.uuid })
    }

    for (const v of data) {
      await server.servers.waitUntilLog('Removed files of video ' + v.url)
    }

    await sqlCommand.cleanup()
    await cleanupTests([ server ])
  })
})
