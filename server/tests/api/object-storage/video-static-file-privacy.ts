/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { basename } from 'path'
import { checkVideoFileTokenReinjection, expectStartWith } from '@server/tests/shared'
import { areScalewayObjectStorageTestsDisabled, getAllFiles, getHLS } from '@shared/core-utils'
import { HttpStatusCode, LiveVideo, VideoDetails, VideoPrivacy } from '@shared/models'
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
} from '@shared/server-commands'

function extractFilenameFromUrl (url: string) {
  const parts = basename(url).split(':')

  return parts[parts.length - 1]
}

describe('Object storage for video static file privacy', function () {
  // We need real world object storage to check ACL
  if (areScalewayObjectStorageTestsDisabled()) return

  let server: PeerTubeServer
  let userToken: string

  // ---------------------------------------------------------------------------

  async function checkPrivateVODFiles (uuid: string) {
    const video = await server.videos.getWithToken({ id: uuid })

    for (const file of video.files) {
      expectStartWith(file.fileUrl, server.url + '/object-storage-proxy/webseed/private/')

      await makeRawRequest({ url: file.fileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    }

    for (const file of getAllFiles(video)) {
      const internalFileUrl = await server.sql.getInternalFileUrl(file.id)
      expectStartWith(internalFileUrl, ObjectStorageCommand.getScalewayBaseUrl())
      await makeRawRequest({ url: internalFileUrl, token: server.accessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
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
  })

  describe('VOD', function () {
    let privateVideoUUID: string
    let publicVideoUUID: string
    let userPrivateVideoUUID: string

    // ---------------------------------------------------------------------------

    async function getSampleFileUrls (videoId: string) {
      const video = await server.videos.getWithToken({ id: videoId })

      return {
        webTorrentFile: video.files[0].fileUrl,
        hlsFile: getHLS(video).files[0].fileUrl
      }
    }

    // ---------------------------------------------------------------------------

    it('Should upload a private video and have appropriate object storage ACL', async function () {
      this.timeout(60000)

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

    it('Should upload a public video and have appropriate object storage ACL', async function () {
      this.timeout(60000)

      const { uuid } = await server.videos.quickUpload({ name: 'video', privacy: VideoPrivacy.UNLISTED })
      await waitJobs([ server ])

      publicVideoUUID = uuid

      await checkPublicVODFiles(publicVideoUUID)
    })

    it('Should not get files without appropriate OAuth token', async function () {
      this.timeout(60000)

      const { webTorrentFile, hlsFile } = await getSampleFileUrls(privateVideoUUID)

      await makeRawRequest({ url: webTorrentFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({ url: webTorrentFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

      await makeRawRequest({ url: hlsFile, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeRawRequest({ url: hlsFile, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
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

    it('Should correctly check OAuth or video file token', async function () {
      this.timeout(60000)

      const badVideoFileToken = await server.videoToken.getVideoFileToken({ token: userToken, videoId: userPrivateVideoUUID })
      const goodVideoFileToken = await server.videoToken.getVideoFileToken({ videoId: privateVideoUUID })

      const { webTorrentFile, hlsFile } = await getSampleFileUrls(privateVideoUUID)

      for (const url of [ webTorrentFile, hlsFile ]) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

        await makeRawRequest({ url, query: { videoFileToken: badVideoFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await makeRawRequest({ url, query: { videoFileToken: goodVideoFileToken }, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should reinject video file token', async function () {
      this.timeout(120000)

      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: privateVideoUUID })

      await checkVideoFileTokenReinjection({
        server,
        videoUUID: privateVideoUUID,
        videoFileToken,
        resolutions: [ 240, 720 ],
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

    let unrelatedFileToken: string

    // ---------------------------------------------------------------------------

    async function checkLiveFiles (live: LiveVideo, liveId: string) {
      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await server.live.waitUntilPublished({ videoId: liveId })

      const video = await server.videos.getWithToken({ id: liveId })
      const fileToken = await server.videoToken.getVideoFileToken({ videoId: video.uuid })

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
        const { video, live } = await server.live.quickCreate({ saveReplay: true, permanentLive: false, privacy: VideoPrivacy.PRIVATE })
        normalLiveId = video.uuid
        normalLive = live
      }

      {
        const { video, live } = await server.live.quickCreate({ saveReplay: true, permanentLive: true, privacy: VideoPrivacy.PRIVATE })
        permanentLiveId = video.uuid
        permanentLive = live
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
        resolutions: [ 720 ],
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

      const live = await server.videos.getWithToken({ id: permanentLiveId })
      const replayFromList = await findExternalSavedVideo(server, live)
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
      const webtorrentFilename = extractFilenameFromUrl(privateVideo.files[0].fileUrl)
      const hlsFilename = extractFilenameFromUrl(getHLS(privateVideo).files[0].fileUrl)

      await makeRawRequest({
        url: server.url + '/object-storage-proxy/webseed/private/' + webtorrentFilename,
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

    await cleanupTests([ server ])
  })
})
