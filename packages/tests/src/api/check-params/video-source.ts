import { HttpStatusCode, VideoSource } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video sources API validator', function () {
  let server: PeerTubeServer = null

  let videoId: string
  let userVideoId: string

  let userToken: string
  let userId: number

  let editorToken: string
  let userEditorToken: string
  let anotherUserToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    anotherUserToken = await server.users.generateUserAndToken('another_user')

    const res = await server.users.generate('user')
    userToken = res.token
    userId = res.userId

    editorToken = await server.channelCollaborators.createEditor('editor', 'root_channel')
    userEditorToken = await server.channelCollaborators.createEditor('user_editor', 'user_channel')
  })

  describe('When getting latest source', function () {
    before(async function () {
      const created = await server.videos.quickUpload({ name: 'video' })
      videoId = created.uuid
    })

    it('Should fail without a valid uuid', async function () {
      await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df563d0b0', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should receive 404 when passing a non existing video id', async function () {
      await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not get the source as unauthenticated', async function () {
      await server.videos.getSource({ id: videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, token: null })
    })

    it('Should not get the source with another user', async function () {
      await server.videos.getSource({ id: videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: userToken })
    })

    it('Should succeed with the correct parameters', async function () {
      for (const token of [ server.accessToken, editorToken ]) {
        await server.videos.getSource({ id: videoId, token })
      }
    })
  })

  describe('When updating source video file', function () {
    before(async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'video' })
      videoId = uuid

      await waitJobs([ server ])
    })

    it('Should fail if not enabled on the instance', async function () {
      await server.config.disableFileUpdate()

      await server.videos.replaceSourceFile({ videoId, fixture: 'video_short.mp4', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail on an unknown video', async function () {
      await server.config.enableFileUpdate()

      await server.videos.replaceSourceFile({ videoId: 404, fixture: 'video_short.mp4', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an invalid video', async function () {
      await server.config.enableLive({ allowReplay: false })

      const { video } = await server.live.quickCreate({ saveReplay: false, permanentLive: true })
      await server.videos.replaceSourceFile({
        videoId: video.uuid,
        fixture: 'video_short.mp4',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail without token', async function () {
      await server.videos.replaceSourceFile({
        token: null,
        videoId,
        fixture: 'video_short.mp4',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another user', async function () {
      await server.videos.replaceSourceFile({
        token: userToken,
        videoId,
        fixture: 'video_short.mp4',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an incorrect input file', async function () {
      await server.videos.replaceSourceFile({
        fixture: 'video_short_fake.webm',
        videoId,
        completedExpectedStatus: HttpStatusCode.UNPROCESSABLE_ENTITY_422
      })

      await server.videos.replaceSourceFile({
        fixture: 'video_short.mkv',
        videoId,
        expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415
      })
    })

    it('Should fail if quota is exceeded', async function () {
      this.timeout(60000)

      const { uuid } = await server.videos.quickUpload({ name: 'user video', token: userToken })
      userVideoId = uuid
      await waitJobs([ server ])

      await server.users.update({ userId, videoQuota: 1 })

      for (const token of [ server.accessToken, userEditorToken, userToken ]) {
        await server.videos.replaceSourceFile({
          token,
          videoId: userVideoId,
          fixture: 'video_short.mp4',
          expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      this.timeout(60000)

      await server.users.update({ userId, videoQuota: 1000 * 1000 * 1000 })

      for (const token of [ server.accessToken, userEditorToken, userToken ]) {
        await server.videos.replaceSourceFile({ token, videoId: userVideoId, fixture: 'video_short.mp4' })
      }
    })
  })

  describe('When downloading the source file', function () {
    let source: VideoSource

    before(async function () {
      this.timeout(60000)

      await server.config.enableMinimumTranscoding({ hls: true, keepOriginal: true, webVideo: true })

      const { uuid } = await server.videos.quickUpload({ name: 'video', token: userToken })
      userVideoId = uuid

      await waitJobs([ server ])

      await server.config.disableTranscoding()

      source = await server.videos.getSource({ id: userVideoId, token: userToken })
    })

    it('Should fail with an invalid filename', async function () {
      await makeRawRequest({ url: server.url + '/download/original-video-files/hello.mp4', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail without user token or video file token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid user token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, token: 'toto', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid video file token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, query: { videoFileToken: 'toto' }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with user token of another user', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, token: anotherUserToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with video file token of another user', async function () {
      const anotherFileToken = await server.videoToken.getVideoFileToken({ videoId: userVideoId, token: anotherUserToken })

      await makeRawRequest({
        url: source.fileDownloadUrl,
        query: { videoFileToken: anotherFileToken },
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with a valid user token', async function () {
      for (const token of [ server.accessToken, userToken, userEditorToken ]) {
        await makeRawRequest({ url: source.fileDownloadUrl, token, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should succeed with a valid query token', async function () {
      for (const token of [ server.accessToken, userEditorToken, userToken ]) {
        const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: userVideoId, token })

        await makeRawRequest({ url: source.fileDownloadUrl, query: { videoFileToken }, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  describe('When deleting video source file', function () {
    it('Should fail without token', async function () {
      await server.videos.deleteSource({ id: userVideoId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      await server.videos.deleteSource({ id: userVideoId, token: anotherUserToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown video', async function () {
      await server.videos.deleteSource({ id: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      for (const token of [ userToken, server.accessToken, userEditorToken ]) {
        await server.videos.deleteSource({ id: userVideoId, token })

        await server.videos.replaceSourceFile({ token, videoId: userVideoId, fixture: 'video_short.mp4' })
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
