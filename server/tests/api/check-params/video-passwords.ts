/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import {
  FIXTURE_URLS,
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination,
  checkUploadVideoParam
} from '@server/tests/shared'
import { root } from '@shared/core-utils'
import {
  HttpStatusCode,
  PeerTubeProblemDocument,
  ServerErrorCode,
  VideoCreateResult,
  VideoPassword,
  VideoPrivacy
} from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@shared/server-commands'
import { expect } from 'chai'
import { join } from 'path'

describe('Test video passwords validator', function () {
  let path: string
  let server: PeerTubeServer
  let userAccessToken = ''
  let video: VideoCreateResult
  let channelId: number
  let publicVideo: VideoCreateResult
  let passwords: VideoPassword[]
  let commentId: number
  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(50000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    userAccessToken = await server.users.generateUserAndToken('user1')

    {
      const body = await server.users.getMyInfo()
      channelId = body.videoChannels[0].id
    }

    {
      video = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1', 'password2' ]
      })
    }
    path = '/api/v1/videos/'
  })

  async function checkVideoPasswordParam (options: {
    server: PeerTubeServer
    token: string
    videoPasswords: string[]
    expectedStatus: HttpStatusCode
    mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords'
  }) {
    const { server, token, videoPasswords, expectedStatus = HttpStatusCode.OK_200, mode } = options
    const attaches = {
      fixture: join(root(), 'server', 'tests', 'fixtures', 'video_short.webm')
    }
    const baseCorrectParams = {
      name: 'my super name',
      category: 5,
      licence: 1,
      language: 'pt',
      nsfw: false,
      commentsEnabled: true,
      downloadEnabled: true,
      waitTranscoding: true,
      description: 'my super description',
      support: 'my super support text',
      tags: [ 'tag1', 'tag2' ],
      privacy: VideoPrivacy.PASSWORD_PROTECTED,
      channelId,
      originallyPublishedAt: new Date().toISOString()
    }
    if (mode === 'uploadLegacy') {
      const fields = { ...baseCorrectParams, videoPasswords }
      return checkUploadVideoParam(server, token, { ...fields, ...attaches }, expectedStatus, 'legacy')
    }

    if (mode === 'uploadResumable') {
      const fields = { ...baseCorrectParams, videoPasswords }
      return checkUploadVideoParam(server, token, { ...fields, ...attaches }, expectedStatus, 'resumable')
    }

    if (mode === 'import') {
      const attributes = { ...baseCorrectParams, targetUrl: FIXTURE_URLS.goodVideo, videoPasswords }
      return server.imports.importVideo({ attributes, expectedStatus })
    }

    if (mode === 'updateVideo') {
      const fields = { ...baseCorrectParams, videoPasswords }
      return makePutBodyRequest({
        url: server.url,
        path: path + video.shortUUID,
        token,
        fields,
        expectedStatus
      })
    }

    if (mode === 'updatePasswords') {
      const fields = { passwords: videoPasswords }
      return makePutBodyRequest({
        url: server.url,
        path: path + video.uuid + '/passwords',
        token,
        fields,
        expectedStatus
      })
    }
  }

  function runSuite (mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords') {

    it('Should fail with a password protected privacy without providing a password', async function () {
      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords: undefined,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and an empty password list', async function () {
      const videoPasswords = []

      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and a too short password', async function () {
      const videoPasswords = [ 'p' ]

      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and a too long password', async function () {
      const videoPasswords = [ 'Very very very very very very very very very very very very very very very very very very long password' ]

      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and an empty password', async function () {
      const videoPasswords = [ '' ]

      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and duplicated passwords', async function () {
      const videoPasswords = [ 'password', 'password' ]

      await checkVideoPasswordParam({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should succeed with a password protected privacy and correct passwords', async function () {
      const videoPasswords = [ 'password1', 'password2' ]
      const expectedStatus = mode === 'updatePasswords' || mode === 'updateVideo'
        ? HttpStatusCode.NO_CONTENT_204
        : HttpStatusCode.OK_200

      await checkVideoPasswordParam({ server, token: server.accessToken, videoPasswords, expectedStatus, mode })
    })
  }

  describe('When adding or updating a video', function () {
    describe('Resumable upload', function () {
      runSuite('uploadResumable')
    })

    describe('Legacy upload', function () {
      runSuite('uploadLegacy')
    })

    describe('When importing a video', function () {
      runSuite('import')
    })

    describe('When updating a video', function () {
      runSuite('updateVideo')
    })

    describe('When updating the password list of a video', function () {
      runSuite('updatePasswords')
    })
  })

  async function checkVideoPasswordParam2 (options: {
    server: PeerTubeServer
    token?: string
    videoPassword?: string
    expectedStatus: HttpStatusCode
    mode: 'get' | 'getWithPassword' | 'getWithToken' | 'listCaptions' | 'createThread' | 'listThreads' | 'replyThread' | 'rate' | 'token'
  }) {
    const { server, token = null, videoPassword, expectedStatus, mode } = options

    if (mode === 'get') {
      return server.videos.get({ id: video.id, expectedStatus })
    }

    if (mode === 'getWithToken') {
      return server.videos.getWithToken({
        id: video.id,
        token,
        expectedStatus
      })
    }

    if (mode === 'getWithPassword') {
      return server.videos.getWithPassword({
        id: video.id,
        token,
        expectedStatus,
        password: videoPassword
      })
    }

    if (mode === 'rate') {
      return server.videos.rate({
        id: video.id,
        token,
        expectedStatus,
        rating: 'like',
        videoPassword
      })
    }

    if (mode === 'createThread') {
      const fields = { text: 'super comment' }
      const headers = videoPassword !== undefined && videoPassword !== null
        ? { 'x-peertube-video-password': videoPassword }
        : undefined
      return makePostBodyRequest({
        url: server.url,
        path: path + video.uuid + '/comment-threads',
        token,
        fields,
        headers,
        expectedStatus
      })
    }

    if (mode === 'replyThread') {
      const fields = { text: 'super reply' }
      const headers = videoPassword !== undefined && videoPassword !== null
        ? { 'x-peertube-video-password': videoPassword }
        : undefined
      return makePostBodyRequest({
        url: server.url,
        path: path + video.uuid + '/comments/' + commentId,
        token,
        fields,
        headers,
        expectedStatus
      })
    }
    if (mode === 'listThreads') {
      return server.comments.listThreads({
        videoId: video.id,
        token,
        expectedStatus,
        videoPassword
      })
    }

    if (mode === 'listCaptions') {
      return server.captions.list({
        videoId: video.id,
        token,
        expectedStatus,
        videoPassword
      })
    }

    if (mode === 'token') {
      return server.videoToken.create({
        videoId: video.id,
        token,
        expectedStatus,
        videoPassword
      })
    }
  }

  function checkVideoError (error: any, mode: 'providePassword' | 'incorrectPassword') {
    const serverCode = mode === 'providePassword'
      ? ServerErrorCode.VIDEO_REQUIRES_PASSWORD
      : ServerErrorCode.INCORRECT_VIDEO_PASSWORD

    const message = mode === 'providePassword'
      ? 'Please provide a password to access this password protected video'
      : 'Incorrect video password. Access to the video is denied.'

    if (!error.code) {
      error = JSON.parse(error.text)
    }

    expect(error.code).to.equal(serverCode)
    expect(error.detail).to.equal(message)
    expect(error.error).to.equal(message)

    expect(error.status).to.equal(HttpStatusCode.FORBIDDEN_403)
  }

  function runSuite2 (mode: 'get' | 'listCaptions' | 'createThread' | 'listThreads' | 'replyThread' | 'rate' | 'token') {
    const requiresUserAuth = [ 'createThread', 'replyThread', 'rate' ].includes(mode)
    let tokens: string[]
    if (!requiresUserAuth) {
      it('Should fail without providing a password for an unlogged user', async function () {
        const body = await checkVideoPasswordParam2({ server, expectedStatus: HttpStatusCode.FORBIDDEN_403, mode })
        const error = body as unknown as PeerTubeProblemDocument

        checkVideoError(error, 'providePassword')
      })
    }

    it('Should fail without providing a password for an unauthorised user', async function () {
      const tmp = mode === 'get' ? 'getWithToken' : mode

      const body = await checkVideoPasswordParam2({
        server,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        mode: tmp
      })

      const error = body as unknown as PeerTubeProblemDocument

      checkVideoError(error, 'providePassword')
    })

    it('Should fail if a wrong password is entered', async function () {
      const tmp = mode === 'get' ? 'getWithPassword' : mode
      tokens = [ userAccessToken, server.accessToken ]

      if (!requiresUserAuth) tokens.push(null)

      for (const token of tokens) {
        const body = await checkVideoPasswordParam2({
          server,
          token,
          videoPassword: 'toto',
          expectedStatus: HttpStatusCode.FORBIDDEN_403,
          mode: tmp
        })
        const error = body as unknown as PeerTubeProblemDocument

        checkVideoError(error, 'incorrectPassword')
      }
    })

    it('Should fail if an empty password is entered', async function () {
      const tmp = mode === 'get' ? 'getWithPassword' : mode

      for (const token of tokens) {
        const body = await checkVideoPasswordParam2({
          server,
          token,
          videoPassword: '',
          expectedStatus: HttpStatusCode.FORBIDDEN_403,
          mode: tmp
        })
        const error = body as unknown as PeerTubeProblemDocument

        checkVideoError(error, 'incorrectPassword')
      }
    })

    it('Should fail if an inccorect password containing the correct password is entered', async function () {
      const tmp = mode === 'get' ? 'getWithPassword' : mode

      for (const token of tokens) {
        const body = await checkVideoPasswordParam2({
          server,
          token,
          videoPassword: 'password11',
          expectedStatus: HttpStatusCode.FORBIDDEN_403,
          mode: tmp
        })
        const error = body as unknown as PeerTubeProblemDocument

        checkVideoError(error, 'incorrectPassword')
      }
    })

    it('Should succeed without providing a password for an authorised user', async function () {
      const tmp = mode === 'get' ? 'getWithToken' : mode
      const expectedStatus = mode === 'rate' ? HttpStatusCode.NO_CONTENT_204 : HttpStatusCode.OK_200

      const body = await checkVideoPasswordParam2({ server, token: server.accessToken, expectedStatus, mode: tmp })
      if (mode === 'createThread') {
        const res = body as any
        commentId = JSON.parse(res.text).comment.id
      }
    })

    it('Should succeed using correct passwords', async function () {
      const tmp = mode === 'get' ? 'getWithPassword' : mode
      const expectedStatus = mode === 'rate' ? HttpStatusCode.NO_CONTENT_204 : HttpStatusCode.OK_200

      for (const token of tokens) {
        await checkVideoPasswordParam2({ server, videoPassword: 'password1', token, expectedStatus, mode: tmp })
        await checkVideoPasswordParam2({ server, videoPassword: 'password2', token, expectedStatus, mode: tmp })
      }
    })
  }

  describe('When accessing with a password', function () {

    describe('For getting a password protected video', function () {
      runSuite2('get')
    })

    describe('For rating a video', function () {
      runSuite2('rate')
    })

    describe('For creating a thread', function () {
      runSuite2('createThread')
    })

    describe('For replying to a thread', function () {
      runSuite2('replyThread')
    })

    describe('For listing threads', function () {
      runSuite2('listThreads')
    })

    describe('For getting captions', function () {
      runSuite2('listCaptions')
    })

    describe('For creatin video file token', function () {
      runSuite2('token')
    })
  })

  describe('When listing passwords', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path + video.uuid + '/passwords', server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path + video.uuid + '/passwords', server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path + video.uuid + '/passwords', server.accessToken)
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + video.uuid + '/passwords',
        token:server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When deleting a password', async function () {

    it('Should fail with wrong password id', async function () {
      await server.videoPasswords.remove({ id: -1, videoId: video.id, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail for non password protected video', async function () {
      publicVideo = await server.videos.quickUpload({ name: 'public video' })
      passwords = (await server.videoPasswords.list({ videoId: video.id })).data
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: publicVideo.id, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail for password not linked to correct video', async function () {
      const video2 = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1', 'password2' ]
      })
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: video2.id, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with correct parameter', async function () {
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: video.id, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
    })

    it('Should fail for last password of a video', async function () {
      await server.videoPasswords.remove({ id: passwords[1].id, videoId: video.id, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
