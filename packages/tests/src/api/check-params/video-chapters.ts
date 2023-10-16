/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, Video, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test videos chapters API validator', function () {
  let server: PeerTubeServer
  let video: VideoCreateResult
  let live: Video
  let privateVideo: VideoCreateResult
  let userAccessToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    video = await server.videos.upload()
    privateVideo = await server.videos.upload({ attributes: { privacy: VideoPrivacy.PRIVATE } })
    userAccessToken = await server.users.generateUserAndToken('user1')

    await server.config.enableLive({ allowReplay: false })

    const res = await server.live.quickCreate({ saveReplay: false, permanentLive: false })
    live = res.video
  })

  describe('When updating chapters', function () {

    it('Should fail without a valid uuid', async function () {
      await server.chapters.update({ videoId: '4da6fd', chapters: [], expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown id', async function () {
      await server.chapters.update({
        videoId: 'ce0801ef-7124-48df-9b22-b473ace78797',
        chapters: [],
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail without access token', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [],
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad access token', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [],
        token: 'toto',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a another user access token', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [],
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a wrong chapters param', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: 'hello' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad chapter title', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: '', timecode: 21 } ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: 'a'.repeat(150), timecode: 21 } ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad timecode', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: 'title', timecode: -5 } ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: 'title', timecode: 'hi' as any } ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with non unique timecodes', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: 'title', timecode: 22 }, { title: 'hello', timecode: 21 } ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to create chapters on a live', async function () {
      await server.chapters.update({
        videoId: live.id,
        chapters: [],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct params', async function () {
      await server.chapters.update({
        videoId: video.id,
        chapters: []
      })

      await server.chapters.update({
        videoId: video.id,
        chapters: [ { title: 'hello', timecode: 21 }, { title: 'hello 2', timecode: 35 } ]
      })
    })
  })

  describe('When listing chapters', function () {

    it('Should fail without a valid uuid', async function () {
      await server.chapters.list({ videoId: '4da6fd', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown id', async function () {
      await server.chapters.list({ videoId: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not list private chapters to anyone', async function () {
      await server.chapters.list({ videoId: privateVideo.uuid, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not list private chapters to another user', async function () {
      await server.chapters.list({ videoId: privateVideo.uuid, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should list chapters', async function () {
      await server.chapters.list({ videoId: privateVideo.uuid })
      await server.chapters.list({ videoId: video.uuid })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
