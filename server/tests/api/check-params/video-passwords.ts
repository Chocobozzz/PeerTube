/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@server/tests/shared'
import { HttpStatusCode, PeerTubeProblemDocument, VideoCreateResult, VideoPassword, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@shared/server-commands'
import { expect } from 'chai'

describe('Test video passwords validator', function () {
  let path: string
  let server: PeerTubeServer
  let userAccessToken = ''
  let video: VideoCreateResult
  let publicVideo: VideoCreateResult
  let passwords: VideoPassword[]
  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(50000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    userAccessToken = await server.users.generateUserAndToken('user1')
    {
      video = await server.videos.quickUpload({
        name: 'password protected video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1', 'password2' ]
      })
    }
    path = '/api/v1/videos/' + video.uuid + '/passwords'
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
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, token:server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When updating the password list of a video', function () {
    const baseCorrectParams = {
      passwords: [ 'new password 1', 'new password 2' ]
    }

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an empty password list', async function () {
      const fields = { passwords: [] }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an empty password', async function () {
      const fields = { passwords: [ '' ] }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too short password', async function () {
      const fields = { passwords: [ 'p' ] }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with duplicated passwords', async function () {
      const fields = { passwords: [ 'password', 'password' ] }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with correct parameters', async function () {
      const fields = baseCorrectParams
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
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
