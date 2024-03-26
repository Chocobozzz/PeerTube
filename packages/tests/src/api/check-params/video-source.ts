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
  let uuid: string
  let userToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userToken = await server.users.generateUserAndToken('user1')
  })

  describe('When getting latest source', function () {

    before(async function () {
      const created = await server.videos.quickUpload({ name: 'video' })
      uuid = created.uuid
    })

    it('Should fail without a valid uuid', async function () {
      await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df563d0b0', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should receive 404 when passing a non existing video id', async function () {
      await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not get the source as unauthenticated', async function () {
      await server.videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, token: null })
    })

    it('Should not get the source with another user', async function () {
      await server.videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: userToken })
    })

    it('Should succeed with the correct parameters get the source as another user', async function () {
      await server.videos.getSource({ id: uuid })
    })
  })

  describe('When updating source video file', function () {
    let userAccessToken: string
    let userId: number

    let videoId: string
    let userVideoId: string

    before(async function () {
      const res = await server.users.generate('user2')
      userAccessToken = res.token
      userId = res.userId

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
        token: userAccessToken,
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

      const { uuid } = await server.videos.quickUpload({ name: 'user video' })
      userVideoId = uuid
      await waitJobs([ server ])

      await server.users.update({ userId, videoQuota: 1 })
      await server.videos.replaceSourceFile({
        token: userAccessToken,
        videoId: uuid,
        fixture: 'video_short.mp4',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      this.timeout(60000)

      await server.users.update({ userId, videoQuota: 1000 * 1000 * 1000 })
      await server.videos.replaceSourceFile({ videoId: userVideoId, fixture: 'video_short.mp4' })
    })
  })

  describe('When downloading the source file', function () {
    let videoFileToken: string
    let videoId: string
    let source: VideoSource
    let user3: string
    let user4: string

    before(async function () {
      this.timeout(60000)

      user3 = await server.users.generateUserAndToken('user3')
      user4 = await server.users.generateUserAndToken('user4')

      await server.config.enableMinimumTranscoding({ hls: true, keepOriginal: true, webVideo: true })

      const { uuid } = await server.videos.quickUpload({ name: 'video', token: user3 })

      videoId = uuid
      videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid, token: user3 })

      await waitJobs([ server ])

      source = await server.videos.getSource({ id: videoId, token: user3 })
    })

    it('Should fail with an invalid filename', async function () {
      await makeRawRequest({ url: server.url + '/download/original-video-files/hello.mp4', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail without header token or video file token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an invalid header token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, token: 'toto', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid video file token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, query: { videoFileToken: 'toto' }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with header token of another user', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, token: user4, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with video file token of another user', async function () {
      const videoFileToken = await server.videoToken.getVideoFileToken({ videoId: uuid, token: user4 })

      await makeRawRequest({ url: source.fileDownloadUrl, query: { videoFileToken }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with a valid header token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, token: user3, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should succeed with a valid header token', async function () {
      await makeRawRequest({ url: source.fileDownloadUrl, query: { videoFileToken }, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When deleting video source file', function () {
    let userAccessToken: string

    let videoId: string

    before(async function () {
      userAccessToken = await server.users.generateUserAndToken('user56')

      await server.config.enableMinimumTranscoding({ keepOriginal: true })
      const { uuid } = await server.videos.quickUpload({ name: 'with source' })
      videoId = uuid

      await waitJobs([ server ])
    })

    it('Should fail without token', async function () {
      await server.videos.deleteSource({ id: videoId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      await server.videos.deleteSource({ id: videoId, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown video', async function () {
      await server.videos.deleteSource({ id: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await server.videos.deleteSource({ id: videoId })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
