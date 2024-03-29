import {
  HttpStatusCode,
  HttpStatusCodeType,
  PeerTubeProblemDocument,
  ServerErrorCode,
  VideoCommentPolicy,
  VideoCreateResult,
  VideoPrivacy
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { checkUploadVideoParam } from '@tests/shared/videos.js'
import { expect } from 'chai'

describe('Test video passwords validator', function () {
  let path: string
  let server: PeerTubeServer
  let userAccessToken = ''
  let video: VideoCreateResult
  let channelId: number
  let publicVideo: VideoCreateResult
  let commentId: number
  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(50000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    await server.config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          latencySetting: {
            enabled: false
          },
          allowReplay: false
        },
        import: {
          videos: {
            http:{
              enabled: true
            }
          }
        }
      }
    })

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

  async function checkVideoPasswordOptions (options: {
    server: PeerTubeServer
    token: string
    videoPasswords: string[]
    expectedStatus: HttpStatusCodeType
    mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords' | 'live'
  }) {
    const { server, token, videoPasswords, expectedStatus = HttpStatusCode.OK_200, mode } = options
    const attaches = {
      fixture: buildAbsoluteFixturePath('video_short.webm')
    }
    const baseCorrectParams = {
      name: 'my super name',
      category: 5,
      licence: 1,
      language: 'pt',
      nsfw: false,
      commentsPolicy: VideoCommentPolicy.ENABLED,
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
      return checkUploadVideoParam({ server, token, attributes: { ...fields, ...attaches }, expectedStatus, mode: 'legacy' })
    }

    if (mode === 'uploadResumable') {
      const fields = { ...baseCorrectParams, videoPasswords }
      return checkUploadVideoParam({ server, token, attributes: { ...fields, ...attaches }, expectedStatus, mode: 'resumable' })
    }

    if (mode === 'import') {
      const attributes = { ...baseCorrectParams, targetUrl: FIXTURE_URLS.goodVideo, videoPasswords }
      return server.videoImports.importVideo({ attributes, expectedStatus })
    }

    if (mode === 'updateVideo') {
      const attributes = { ...baseCorrectParams, videoPasswords }
      return server.videos.update({ token, expectedStatus, id: video.id, attributes })
    }

    if (mode === 'updatePasswords') {
      return server.videoPasswords.updateAll({ token, expectedStatus, videoId: video.id, passwords: videoPasswords })
    }

    if (mode === 'live') {
      const fields = { ...baseCorrectParams, videoPasswords }

      return server.live.create({ fields, expectedStatus })
    }
  }

  function validateVideoPasswordList (mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords' | 'live') {

    it('Should fail with a password protected privacy without providing a password', async function () {
      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords: undefined,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and an empty password list', async function () {
      const videoPasswords = []

      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and a too short password', async function () {
      const videoPasswords = [ 'p' ]

      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and a too long password', async function () {
      const videoPasswords = [ 'Very very very very very very very very very very very very very very very very very very long password' ]

      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and an empty password', async function () {
      const videoPasswords = [ '' ]

      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    it('Should fail with a password protected privacy and duplicated passwords', async function () {
      const videoPasswords = [ 'password', 'password' ]

      await checkVideoPasswordOptions({
        server,
        token: server.accessToken,
        videoPasswords,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400,
        mode
      })
    })

    if (mode === 'updatePasswords') {
      it('Should fail for an unauthenticated user', async function () {
        const videoPasswords = [ 'password' ]
        await checkVideoPasswordOptions({
          server,
          token: null,
          videoPasswords,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401,
          mode
        })
      })

      it('Should fail for an unauthorized user', async function () {
        const videoPasswords = [ 'password' ]
        await checkVideoPasswordOptions({
          server,
          token: userAccessToken,
          videoPasswords,
          expectedStatus: HttpStatusCode.FORBIDDEN_403,
          mode
        })
      })
    }

    it('Should succeed with a password protected privacy and correct passwords', async function () {
      const videoPasswords = [ 'password1', 'password2' ]
      const expectedStatus = mode === 'updatePasswords' || mode === 'updateVideo'
        ? HttpStatusCode.NO_CONTENT_204
        : HttpStatusCode.OK_200

      await checkVideoPasswordOptions({ server, token: server.accessToken, videoPasswords, expectedStatus, mode })
    })
  }

  describe('When adding or updating a video', function () {
    describe('Resumable upload', function () {
      validateVideoPasswordList('uploadResumable')
    })

    describe('Legacy upload', function () {
      validateVideoPasswordList('uploadLegacy')
    })

    describe('When importing a video', function () {
      validateVideoPasswordList('import')
    })

    describe('When updating a video', function () {
      validateVideoPasswordList('updateVideo')
    })

    describe('When updating the password list of a video', function () {
      validateVideoPasswordList('updatePasswords')
    })

    describe('When creating a live', function () {
      validateVideoPasswordList('live')
    })
  })

  async function checkVideoAccessOptions (options: {
    server: PeerTubeServer
    token?: string
    videoPassword?: string
    expectedStatus: HttpStatusCodeType
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
      const body = await makePostBodyRequest({
        url: server.url,
        path: path + video.uuid + '/comment-threads',
        token,
        fields,
        headers,
        expectedStatus
      })
      return JSON.parse(body.text)
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

  function validateVideoAccess (mode: 'get' | 'listCaptions' | 'createThread' | 'listThreads' | 'replyThread' | 'rate' | 'token') {
    const requiresUserAuth = [ 'createThread', 'replyThread', 'rate' ].includes(mode)
    let tokens: string[]
    if (!requiresUserAuth) {
      it('Should fail without providing a password for an unlogged user', async function () {
        const body = await checkVideoAccessOptions({ server, expectedStatus: HttpStatusCode.FORBIDDEN_403, mode })
        const error = body as unknown as PeerTubeProblemDocument

        checkVideoError(error, 'providePassword')
      })
    }

    it('Should fail without providing a password for an unauthorised user', async function () {
      const tmp = mode === 'get' ? 'getWithToken' : mode

      const body = await checkVideoAccessOptions({
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
        const body = await checkVideoAccessOptions({
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
        const body = await checkVideoAccessOptions({
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
        const body = await checkVideoAccessOptions({
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

      const body = await checkVideoAccessOptions({ server, token: server.accessToken, expectedStatus, mode: tmp })

      if (mode === 'createThread') commentId = body.comment.id
    })

    it('Should succeed using correct passwords', async function () {
      const tmp = mode === 'get' ? 'getWithPassword' : mode
      const expectedStatus = mode === 'rate' ? HttpStatusCode.NO_CONTENT_204 : HttpStatusCode.OK_200

      for (const token of tokens) {
        await checkVideoAccessOptions({ server, videoPassword: 'password1', token, expectedStatus, mode: tmp })
        await checkVideoAccessOptions({ server, videoPassword: 'password2', token, expectedStatus, mode: tmp })
      }
    })
  }

  describe('When accessing password protected video', function () {

    describe('For getting a password protected video', function () {
      validateVideoAccess('get')
    })

    describe('For rating a video', function () {
      validateVideoAccess('rate')
    })

    describe('For creating a thread', function () {
      validateVideoAccess('createThread')
    })

    describe('For replying to a thread', function () {
      validateVideoAccess('replyThread')
    })

    describe('For listing threads', function () {
      validateVideoAccess('listThreads')
    })

    describe('For getting captions', function () {
      validateVideoAccess('listCaptions')
    })

    describe('For creating video file token', function () {
      validateVideoAccess('token')
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

    it('Should fail for unauthenticated user', async function () {
      await server.videoPasswords.list({
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401,
        videoId: video.id
      })
    })

    it('Should fail for unauthorized user', async function () {
      await server.videoPasswords.list({
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        videoId: video.id
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await server.videoPasswords.list({
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200,
        videoId: video.id
      })
    })
  })

  describe('When deleting a password', async function () {
    const passwords = (await server.videoPasswords.list({ videoId: video.id })).data

    it('Should fail with wrong password id', async function () {
      await server.videoPasswords.remove({ id: -1, videoId: video.id, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail for unauthenticated user', async function () {
      await server.videoPasswords.remove({
        id: passwords[0].id,
        token: null,
        videoId: video.id,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail for unauthorized user', async function () {
      await server.videoPasswords.remove({
        id: passwords[0].id,
        token: userAccessToken,
        videoId: video.id,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail for non password protected video', async function () {
      publicVideo = await server.videos.quickUpload({ name: 'public video' })
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
