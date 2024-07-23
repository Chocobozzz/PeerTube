/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRole, VideoDetails, VideoPrivacy, VideoResolution } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test videos files', function () {
  let servers: PeerTubeServer[]

  let userToken: string
  let moderatorToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user', UserRole.USER)
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)
  })

  describe('Getting metadata', function () {
    let video: VideoDetails

    before(async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      video = await servers[0].videos.getWithToken({ id: uuid })
    })

    it('Should not get metadata of private video without token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      }
    })

    it('Should not get metadata of private video without the appropriate token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should get metadata of private video with the appropriate token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, token: servers[0].accessToken, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  describe('Deleting files', function () {
    let webVideoId: string
    let hlsId: string
    let remoteId: string

    let validId1: string
    let validId2: string

    let hlsFileId: number
    let webVideoFileId: number

    let remoteHLSFileId: number
    let remoteWebVideoFileId: number

    let splittedHLSId: string
    let hlsWithAudioId: string

    before(async function () {
      this.timeout(300_000)

      const resolutions = [ VideoResolution.H_NOVIDEO, VideoResolution.H_144P, VideoResolution.H_240P ]

      {
        const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
        await waitJobs(servers)

        const video = await servers[1].videos.get({ id: uuid })
        remoteId = video.uuid
        remoteHLSFileId = video.streamingPlaylists[0].files[0].id
        remoteWebVideoFileId = video.files[0].id
      }

      {
        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions })

        {
          const { uuid } = await servers[0].videos.quickUpload({ name: 'both 1' })
          await waitJobs(servers)

          const video = await servers[0].videos.get({ id: uuid })
          validId1 = video.uuid
          hlsFileId = video.streamingPlaylists[0].files[0].id
          webVideoFileId = video.files[0].id
        }

        {
          const { uuid } = await servers[0].videos.quickUpload({ name: 'both 2' })
          validId2 = uuid
        }

        await waitJobs(servers)
      }

      {
        await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'hls' })
        hlsId = uuid

        await waitJobs(servers)
      }

      {
        await servers[0].config.enableTranscoding({ webVideo: true, hls: false, resolutions })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'web-video' })
        webVideoId = uuid

        await waitJobs(servers)
      }

      {
        await servers[0].config.enableTranscoding({ webVideo: true, hls: true, splitAudioAndVideo: true, resolutions })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'splitted-audio-video' })
        splittedHLSId = uuid

        await waitJobs(servers)
      }

      {
        await servers[0].config.enableTranscoding({
          webVideo: true,
          hls: true,
          splitAudioAndVideo: false,
          resolutions
        })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'web-video' })
        hlsWithAudioId = uuid
      }

      await waitJobs(servers)
    })

    it('Should not delete files of a unknown video', async function () {
      const expectedStatus = HttpStatusCode.NOT_FOUND_404

      await servers[0].videos.removeHLSPlaylist({ videoId: 404, expectedStatus })
      await servers[0].videos.removeAllWebVideoFiles({ videoId: 404, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: 404, fileId: hlsFileId, expectedStatus })
      await servers[0].videos.removeWebVideoFile({ videoId: 404, fileId: webVideoFileId, expectedStatus })
    })

    it('Should not delete unknown files', async function () {
      const expectedStatus = HttpStatusCode.NOT_FOUND_404

      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: webVideoFileId, expectedStatus })
      await servers[0].videos.removeWebVideoFile({ videoId: validId1, fileId: hlsFileId, expectedStatus })
    })

    it('Should not delete files of a remote video', async function () {
      const expectedStatus = HttpStatusCode.BAD_REQUEST_400

      await servers[0].videos.removeHLSPlaylist({ videoId: remoteId, expectedStatus })
      await servers[0].videos.removeAllWebVideoFiles({ videoId: remoteId, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: remoteId, fileId: remoteHLSFileId, expectedStatus })
      await servers[0].videos.removeWebVideoFile({ videoId: remoteId, fileId: remoteWebVideoFileId, expectedStatus })
    })

    it('Should not delete files by a non admin user', async function () {
      const expectedStatus = HttpStatusCode.FORBIDDEN_403

      await servers[0].videos.removeHLSPlaylist({ videoId: validId1, token: userToken, expectedStatus })
      await servers[0].videos.removeHLSPlaylist({ videoId: validId1, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeAllWebVideoFiles({ videoId: validId1, token: userToken, expectedStatus })
      await servers[0].videos.removeAllWebVideoFiles({ videoId: validId1, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId, token: userToken, expectedStatus })
      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeWebVideoFile({ videoId: validId1, fileId: webVideoFileId, token: userToken, expectedStatus })
      await servers[0].videos.removeWebVideoFile({ videoId: validId1, fileId: webVideoFileId, token: moderatorToken, expectedStatus })
    })

    it('Should not delete files if the files are not available', async function () {
      await servers[0].videos.removeHLSFile({ videoId: hlsId, fileId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await servers[0].videos.removeWebVideoFile({ videoId: webVideoId, fileId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not delete files if no both versions are available', async function () {
      await servers[0].videos.removeHLSPlaylist({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await servers[0].videos.removeAllWebVideoFiles({ videoId: webVideoId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should delete files if both versions are available', async function () {
      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId })
      await servers[0].videos.removeWebVideoFile({ videoId: validId1, fileId: webVideoFileId })

      await servers[0].videos.removeHLSPlaylist({ videoId: validId1 })
      await servers[0].videos.removeAllWebVideoFiles({ videoId: validId2 })
    })

    it('Should not delete audio if audio and video is splitted', async function () {
      const video = await servers[0].videos.get({ id: splittedHLSId })
      const audio = getHLS(video).files.find(f => f.resolution.id === VideoResolution.H_NOVIDEO)

      await servers[0].videos.removeHLSFile({ videoId: splittedHLSId, fileId: audio.id, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should be able to delete audio if audio is the latest resolution', async function () {
      const video = await servers[0].videos.get({ id: splittedHLSId })
      const audio = getHLS(video).files.find(f => f.resolution.id === VideoResolution.H_NOVIDEO)

      for (const file of getHLS(video).files) {
        if (file.resolution.id === VideoResolution.H_NOVIDEO) continue

        await servers[0].videos.removeHLSFile({ videoId: splittedHLSId, fileId: file.id })
      }

      await servers[0].videos.removeHLSFile({ videoId: splittedHLSId, fileId: audio.id })
    })

    it('Should be able to delete audio of web video', async function () {
      const video = await servers[0].videos.get({ id: splittedHLSId })
      const audio = video.files.find(f => f.resolution.id === VideoResolution.H_NOVIDEO)

      await servers[0].videos.removeWebVideoFile({ videoId: splittedHLSId, fileId: audio.id })
    })

    it('Should be able to delete audio if audio and video are not splitted', async function () {
      const video = await servers[0].videos.get({ id: hlsWithAudioId })
      const audio = getHLS(video).files.find(f => f.resolution.id === VideoResolution.H_NOVIDEO)

      await servers[0].videos.removeHLSFile({ videoId: hlsWithAudioId, fileId: audio.id })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
