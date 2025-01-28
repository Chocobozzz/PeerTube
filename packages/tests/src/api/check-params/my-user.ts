/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { HttpStatusCode, UserRole, VideoCreateResult } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePutBodyRequest,
  makeUploadRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  UsersCommand
} from '@peertube/peertube-server-commands'

describe('Test my user API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let moderatorId: number
  let video: VideoCreateResult
  let server: PeerTubeServer
  let userToken = ''
  let moderatorToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    {
      server = await createSingleServer(1)
      await setAccessTokensToServers([ server ])
    }

    {
      const result = await server.users.generate('user1')
      userToken = result.token
      userId = result.userId
    }

    {
      const result = await server.users.generate('moderator1', UserRole.MODERATOR)
      moderatorToken = result.token
    }

    {
      const result = await server.users.generate('moderator2', UserRole.MODERATOR)
      moderatorId = result.userId
    }

    {
      video = await server.videos.upload()
    }
  })

  describe('When updating my account', function () {

    it('Should fail with an invalid email attribute', async function () {
      const fields = {
        email: 'blabla',
        currentPassword: 'password'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an already existing email attribute', async function () {
      const emails = [ 'moderator1@example.com', 'moderatoR1@example.com' ]

      for (const email of emails) {
        const fields = {
          email,
          currentPassword: 'password'
        }

        await makePutBodyRequest({
          url: server.url,
          path: path + 'me',
          token: userToken,
          fields,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      }
    })

    it('Should fail with a too small password', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'bla'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail without the current password', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid current password', async function () {
      const fields = {
        currentPassword: 'my super password fail',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + 'me',
        token: userToken,
        fields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with an invalid NSFW policy attribute', async function () {
      const fields = {
        nsfwPolicy: 'hello'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid autoPlayVideo attribute', async function () {
      const fields = {
        autoPlayVideo: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid autoPlayNextVideo attribute', async function () {
      const fields = {
        autoPlayNextVideo: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid videosHistoryEnabled attribute', async function () {
      const fields = {
        videosHistoryEnabled: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'my super password'
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + 'me',
        token: 'supertoken',
        fields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a too long description', async function () {
      const fields = {
        description: 'super'.repeat(201)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid videoLanguages attribute', async function () {
      {
        const fields = {
          videoLanguages: 'toto'
        }

        await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
      }

      {
        const languages = []
        for (let i = 0; i < 1000; i++) {
          languages.push('fr')
        }

        const fields = {
          videoLanguages: languages
        }

        await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
      }
    })

    it('Should fail with an invalid theme', async function () {
      const fields = { theme: 'invalid' }
      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an unknown theme', async function () {
      const fields = { theme: 'peertube-theme-unknown' }
      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with invalid no modal attributes', async function () {
      const keys = [
        'noInstanceConfigWarningModal',
        'noAccountSetupWarningModal',
        'noWelcomeModal'
      ]

      for (const key of keys) {
        const fields = {
          [key]: -1
        }

        await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
      }
    })

    it('Should succeed to change password with the correct params', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'my super password',
        nsfwPolicy: 'blur',
        autoPlayVideo: false,
        email: 'super_email@example.com',
        theme: 'default',
        noInstanceConfigWarningModal: true,
        noWelcomeModal: true,
        noAccountSetupWarningModal: true
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + 'me',
        token: userToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed without password change with the correct params', async function () {
      const fields = {
        nsfwPolicy: 'blur',
        autoPlayVideo: false
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + 'me',
        token: userToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When updating my avatar', function () {
    it('Should fail without an incorrect input file', async function () {
      const fields = {}
      const attaches = {
        avatarfile: buildAbsoluteFixturePath('video_short.mp4')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big file', async function () {
      const fields = {}
      const attaches = {
        avatarfile: buildAbsoluteFixturePath('avatar-big.png')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with an unauthenticated user', async function () {
      const fields = {}
      const attaches = {
        avatarfile: buildAbsoluteFixturePath('avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/me/avatar/pick',
        fields,
        attaches,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {}
      const attaches = {
        avatarfile: buildAbsoluteFixturePath('avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/me/avatar/pick',
        token: server.accessToken,
        fields,
        attaches,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When managing my scoped tokens', function () {

    it('Should fail to get my scoped tokens with an non authenticated user', async function () {
      await server.users.getMyScopedTokens({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail to get my scoped tokens with a bad token', async function () {
      await server.users.getMyScopedTokens({ token: 'bad', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

    })

    it('Should succeed to get my scoped tokens', async function () {
      await server.users.getMyScopedTokens()
    })

    it('Should fail to renew my scoped tokens with an non authenticated user', async function () {
      await server.users.renewMyScopedTokens({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail to renew my scoped tokens with a bad token', async function () {
      await server.users.renewMyScopedTokens({ token: 'bad', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed to renew my scoped tokens', async function () {
      await server.users.renewMyScopedTokens()
    })
  })

  describe('When getting my information', function () {
    it('Should fail with a non authenticated user', async function () {
      await server.users.getMyInfo({ token: 'fake_token', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should success with the correct parameters', async function () {
      await server.users.getMyInfo({ token: userToken })
    })
  })

  describe('When getting my video rating', function () {
    let command: UsersCommand

    before(function () {
      command = server.users
    })

    it('Should fail with a non authenticated user', async function () {
      await command.getMyRating({ token: 'fake_token', videoId: video.id, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an incorrect video uuid', async function () {
      await command.getMyRating({ videoId: 'blabla', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown video', async function () {
      await command.getMyRating({ videoId: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct parameters', async function () {
      await command.getMyRating({ videoId: video.id })
      await command.getMyRating({ videoId: video.uuid })
      await command.getMyRating({ videoId: video.shortUUID })
    })
  })

  describe('When retrieving my global ratings', function () {
    const path = '/api/v1/accounts/user1/ratings'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, userToken)
    })

    it('Should fail with a unauthenticated user', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a another user', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad type', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userToken,
        query: { rating: 'toto ' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When getting my global followers', function () {
    const path = '/api/v1/accounts/user1/followers'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, userToken)
    })

    it('Should fail with a unauthenticated user', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a another user', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When blocking/unblocking/removing user', function () {

    it('Should fail with an incorrect id', async function () {
      const options = { userId: 'blabla' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 }

      await server.users.remove(options)
      await server.users.banUser({ userId: 'blabla' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.users.unbanUser({ userId: 'blabla' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with the root user', async function () {
      const options = { userId: rootId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 }

      await server.users.remove(options)
      await server.users.banUser(options)
      await server.users.unbanUser(options)
    })

    it('Should return 404 with a non existing id', async function () {
      const options = { userId: 4545454, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

      await server.users.remove(options)
      await server.users.banUser(options)
      await server.users.unbanUser(options)
    })

    it('Should fail with a non admin user', async function () {
      const options = { userId, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }

      await server.users.remove(options)
      await server.users.banUser(options)
      await server.users.unbanUser(options)
    })

    it('Should fail on a moderator with a moderator', async function () {
      const options = { userId: moderatorId, token: moderatorToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }

      await server.users.remove(options)
      await server.users.banUser(options)
      await server.users.unbanUser(options)
    })

    it('Should succeed on a user with a moderator', async function () {
      const options = { userId, token: moderatorToken }

      await server.users.banUser(options)
      await server.users.unbanUser(options)
    })
  })

  describe('When deleting our account', function () {

    it('Should fail with with the root account', async function () {
      await server.users.deleteMe({ expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
