/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination, checkUploadVideoParam } from '@server/tests/shared'
import { root } from '@shared/core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, VideoCreateResult, VideoPassword, VideoPrivacy } from '@shared/models'
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

  async function checkVideoPasswordParam (
    server: PeerTubeServer,
    token: string,
    videoPasswords: string[],
    expectedStatus = HttpStatusCode.OK_200,
    mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords'
  ) {
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
    switch (mode) {
      case 'uploadLegacy':
        {
          const fields = { ...baseCorrectParams, videoPasswords }
          await checkUploadVideoParam(server, server.accessToken, { ...fields, ...attaches }, expectedStatus, 'legacy')
        }
        break

      case 'uploadResumable':
        {
          const fields = { ...baseCorrectParams, videoPasswords }
          await checkUploadVideoParam(server, server.accessToken, { ...fields, ...attaches }, expectedStatus, 'resumable')
        }
        break

      case 'import':
        break

      case 'updateVideo':
        {
          const fields = { ...baseCorrectParams, videoPasswords }
          await makePutBodyRequest({
            url: server.url,
            path: path + video.shortUUID,
            token: server.accessToken,
            fields,
            expectedStatus
          })
        }
        break

      case 'updatePasswords':
        {
          const fields = { passwords: videoPasswords }
          await makePutBodyRequest({
            url: server.url,
            path: path + video.uuid + '/passwords',
            token: server.accessToken,
            fields,
            expectedStatus
          })
        }
        break
    }
  }

  function runSuite (mode: 'uploadLegacy' | 'uploadResumable' | 'import' | 'updateVideo' | 'updatePasswords') {

    it('Should fail with a password protected privacy without providing a password', async function () {
      await checkVideoPasswordParam(server, server.accessToken, undefined, HttpStatusCode.BAD_REQUEST_400, mode)
    })

    it('Should fail with a password protected privacy and an empty password list', async function () {
      const videoPasswords = []

      await checkVideoPasswordParam(server, server.accessToken, videoPasswords, HttpStatusCode.BAD_REQUEST_400, mode)
    })

    it('Should fail with a password protected privacy and a too short password', async function () {
      const videoPasswords = [ 'p' ]

      await checkVideoPasswordParam(server, server.accessToken, videoPasswords, HttpStatusCode.BAD_REQUEST_400, mode)
    })

    it('Should fail with a password protected privacy and an empty password', async function () {
      const videoPasswords = [ '' ]

      await checkVideoPasswordParam(server, server.accessToken, videoPasswords, HttpStatusCode.BAD_REQUEST_400, mode)
    })

    it('Should fail with a password protected privacy and duplicated passwords', async function () {
      const videoPasswords = [ 'password', 'password' ]

      await checkVideoPasswordParam(server, server.accessToken, videoPasswords, HttpStatusCode.BAD_REQUEST_400, mode)
    })

    it('Should succeed with a password protected privacy and correct passwords', async function () {
      const videoPasswords = [ 'password1', 'password2' ]
      const expectedStatus = mode === 'updatePasswords' || mode === 'updateVideo'
        ? HttpStatusCode.NO_CONTENT_204
        : HttpStatusCode.OK_200

      await checkVideoPasswordParam(server, server.accessToken, videoPasswords, expectedStatus, mode)
    })
  }

  describe('When adding a video', function () {

    describe('Resumable upload', function () {
      runSuite('uploadResumable')
    })

    describe('Legacy upload', function () {
      runSuite('uploadLegacy')
    })
  })

  describe('When getting a password protected video', function () {

    it('Should fail without providing a password for an unlogged user', async function () {
      const body = await server.videos.get({ id: video.id, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      const error = body as unknown as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api/rest-reference.html#operation/getVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Forbidden')

      expect(error.detail).to.equal('Please provide a password to access this password protected video')
      expect(error.error).to.equal('Please provide a password to access this password protected video')

      expect(error.status).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail without providing a password for an unauthorised user', async function () {
      const body = await server.videos.getWithToken({
        id: video.id,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
      const error = body as unknown as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api/rest-reference.html#operation/getVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Forbidden')

      expect(error.detail).to.equal('Please provide a password to access this password protected video')
      expect(error.error).to.equal('Please provide a password to access this password protected video')

      expect(error.status).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail if a wrong password is entered', async function () {
      const body = await server.videos.getWithPassword({
        id: video.id,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        password: 'toto'
      })
      const error = body as unknown as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api/rest-reference.html#operation/getVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Forbidden')

      expect(error.detail).to.equal('Incorrect video password. Access to the video is denied.')
      expect(error.error).to.equal('Incorrect video password. Access to the video is denied.')

      expect(error.status).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail if an empty password is entered', async function () {
      await server.videos.getWithPassword({
        id: video.id,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        password: ''
      })
    })

    it('Should fail if an inccorect password containing the correct password is entered', async function () {
      await server.videos.getWithPassword({
        id: video.id,
        expectedStatus: HttpStatusCode.FORBIDDEN_403,
        password: 'password11'
      })
    })

    it('Should succeed without providing a password for an authorised user', async function () {
      await server.videos.getWithToken({
        id: video.id,
        expectedStatus: HttpStatusCode.OK_200,
        token: server.accessToken
      })
    })

    it('Should succeed using correct passwords', async function () {
      await server.videos.getWithPassword({
        id: video.id,
        expectedStatus: HttpStatusCode.OK_200,
        password: 'password1'
      })

      await server.videos.getWithPassword({
        id: video.id,
        expectedStatus: HttpStatusCode.OK_200,
        password: 'password2'
      })
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

  describe('When updating a video', function () {
    runSuite('updateVideo')
  })

  describe('When updating the password list of a video', function () {
    runSuite('updatePasswords')
  })

  describe('When rating a video', function () {
    it('Should fail without password', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + video.uuid + '/rate',
        token: userAccessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed without password for authorized user', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + video.uuid + '/rate',
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed with any logged user with the correct password', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + video.uuid + '/rate',
        token: userAccessToken,
        fields,
        headers:{
          'video-password': 'password1'
        },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When comment a video', function () {
    describe('Add a comment', function () {
      it('Should fail without password', async function () {
        const fields = { text: 'super comment' }

        await makePostBodyRequest({
          url: server.url,
          path: path + video.uuid + '/comment-threads',
          token: userAccessToken,
          fields,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should succeed without password for authorized user', async function () {
        const fields = { text: 'super comment' }

        await makePostBodyRequest({
          url: server.url,
          path: path + video.uuid + '/comment-threads',
          token: server.accessToken,
          fields,
          expectedStatus: HttpStatusCode.OK_200
        })
      })

      it('Should succeed with any logged user with the correct password', async function () {
        const fields = { text: 'super comment' }

        await makePostBodyRequest({
          url: server.url,
          path: path + video.uuid + '/comment-threads',
          token: server.accessToken,
          fields,
          headers:{
            'video-password': 'password1'
          },
          expectedStatus: HttpStatusCode.OK_200
        })
      })
    })
  })

  describe('When getting captions', function () {
    it('Should fail without password', async function () {
      await makeGetRequest({ url: server.url, path: path + video.shortUUID + '/captions', expectedStatus: HttpStatusCode.FORBIDDEN_403 })

      await makeGetRequest({
        url: server.url,
        path: path + video.uuid + '/captions',
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed without password for authorized user', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + video.uuid + '/captions',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should succeed with any user with the correct password', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + video.shortUUID + '/captions',
        headers:{
          'video-password': 'password1'
        },
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
      passwords = (await server.videoPasswords.listVideoPasswords({ videoId: video.id })).data
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: publicVideo.id, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail for password not linked to correct video', async function () {
      const video2 = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1', 'password2' ]
      })
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: video2.id, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with correct parameter', async function () {
      await server.videoPasswords.remove({ id: passwords[0].id, videoId: video.id, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
    })

    it('Should fail for last password of a video', async function () {
      await server.videoPasswords.remove({ id: passwords[1].id, videoId: video.id, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
