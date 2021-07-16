/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { omit } from 'lodash'
import {
  buildAbsoluteFixturePath,
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination,
  cleanupTests,
  createSingleServer,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  MockSmtpServer,
  PeerTubeServer,
  setAccessTokensToServers,
  UsersCommand
} from '@shared/extra-utils'
import { HttpStatusCode, UserAdminFlag, UserRole, VideoCreateResult } from '@shared/models'

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let moderatorId: number
  let video: VideoCreateResult
  let server: PeerTubeServer
  let serverWithRegistrationDisabled: PeerTubeServer
  let userToken = ''
  let moderatorToken = ''
  let emailPort: number
  let overrideConfig: Object

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    const emails: object[] = []
    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    overrideConfig = { signup: { limit: 8 } }

    {
      const res = await Promise.all([
        createSingleServer(1, overrideConfig),
        createSingleServer(2)
      ])

      server = res[0]
      serverWithRegistrationDisabled = res[1]

      await setAccessTokensToServers([ server ])
    }

    {
      const user = { username: 'user1' }
      await server.users.create({ ...user })
      userToken = await server.login.getAccessToken(user)
    }

    {
      const moderator = { username: 'moderator1' }
      await server.users.create({ ...moderator, role: UserRole.MODERATOR })
      moderatorToken = await server.login.getAccessToken(moderator)
    }

    {
      const moderator = { username: 'moderator2' }
      await server.users.create({ ...moderator, role: UserRole.MODERATOR })
    }

    {
      video = await server.videos.upload()
    }

    {
      const { data } = await server.users.list()
      userId = data.find(u => u.username === 'user1').id
      rootId = data.find(u => u.username === 'root').id
      moderatorId = data.find(u => u.username === 'moderator2').id
    }
  })

  describe('When listing users', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When adding a new user', function () {
    const baseCorrectParams = {
      username: 'user2',
      email: 'test@example.com',
      password: 'my super password',
      videoQuota: -1,
      videoQuotaDaily: -1,
      role: UserRole.USER,
      adminFlags: UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
    }

    it('Should fail with a too small username', async function () {
      const fields = { ...baseCorrectParams, username: '' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = { ...baseCorrectParams, username: 'super'.repeat(50) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a not lowercase username', async function () {
      const fields = { ...baseCorrectParams, username: 'Toto' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = { ...baseCorrectParams, username: 'my username' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { ...baseCorrectParams, email: 'test_example.com' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = { ...baseCorrectParams, password: 'bla' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = { ...baseCorrectParams, password: 'super'.repeat(61) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with empty password and no smtp configured', async function () {
      const fields = { ...baseCorrectParams, password: '' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with no password on a server with smtp enabled', async function () {
      this.timeout(20000)

      await killallServers([ server ])

      const config = {
        ...overrideConfig,

        smtp: {
          hostname: 'localhost',
          port: emailPort
        }
      }
      await server.run(config)

      const fields = {
        ...baseCorrectParams,

        password: '',
        username: 'create_password',
        email: 'create_password@example.com'
      }

      await makePostBodyRequest({
        url: server.url,
        path: path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should fail with invalid admin flags', async function () {
      const fields = { ...baseCorrectParams, adminFlags: 'toto' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: 'super token',
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail if we add a user with the same username', async function () {
      const fields = { ...baseCorrectParams, username: 'user1' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail if we add a user with the same email', async function () {
      const fields = { ...baseCorrectParams, email: 'user1@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail without a videoQuota', async function () {
      const fields = omit(baseCorrectParams, 'videoQuota')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a videoQuotaDaily', async function () {
      const fields = omit(baseCorrectParams, 'videoQuotaDaily')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuota', async function () {
      const fields = { ...baseCorrectParams, videoQuota: -5 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuotaDaily', async function () {
      const fields = { ...baseCorrectParams, videoQuotaDaily: -7 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a user role', async function () {
      const fields = omit(baseCorrectParams, 'role')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role', async function () {
      const fields = { ...baseCorrectParams, role: 88989 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a "peertube" username', async function () {
      const fields = { ...baseCorrectParams, username: 'peertube' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail to create a moderator or an admin with a moderator', async function () {
      for (const role of [ UserRole.MODERATOR, UserRole.ADMINISTRATOR ]) {
        const fields = { ...baseCorrectParams, role }

        await makePostBodyRequest({
          url: server.url,
          path,
          token: moderatorToken,
          fields,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should succeed to create a user with a moderator', async function () {
      const fields = { ...baseCorrectParams, username: 'a4656', email: 'a4656@example.com', role: UserRole.USER }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: moderatorToken,
        fields,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should fail with a non admin user', async function () {
      const user = { username: 'user1' }
      userToken = await server.login.getAccessToken(user)

      const fields = {
        username: 'user3',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: 42000000
      }
      await makePostBodyRequest({ url: server.url, path, token: userToken, fields, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })
  })

  describe('When updating my account', function () {

    it('Should fail with an invalid email attribute', async function () {
      const fields = {
        email: 'blabla'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: server.accessToken, fields })
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
        token: 'super token',
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

    it('Should fail with an invalid noInstanceConfigWarningModal attribute', async function () {
      const fields = {
        noInstanceConfigWarningModal: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
    })

    it('Should fail with an invalid noWelcomeModal attribute', async function () {
      const fields = {
        noWelcomeModal: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userToken, fields })
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
        noWelcomeModal: true
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

  describe('When getting a user', function () {

    it('Should fail with an non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + userId,
        token: 'super token',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path: path + userId, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When updating a user', function () {

    it('Should fail with an invalid email attribute', async function () {
      const fields = {
        email: 'blabla'
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an invalid emailVerified attribute', async function () {
      const fields = {
        emailVerified: 'yes'
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuota attribute', async function () {
      const fields = {
        videoQuota: -90
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role attribute', async function () {
      const fields = {
        role: 54878
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'bla'
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        currentPassword: 'password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + userId,
        token: 'super token',
        fields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail when updating root role', async function () {
      const fields = {
        role: UserRole.MODERATOR
      }

      await makePutBodyRequest({ url: server.url, path: path + rootId, token: server.accessToken, fields })
    })

    it('Should fail with invalid admin flags', async function () {
      const fields = { adminFlags: 'toto' }

      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail to update an admin with a moderator', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + moderatorId,
        token: moderatorToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to update a user with a moderator', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + userId,
        token: moderatorToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        email: 'email@example.com',
        emailVerified: true,
        videoQuota: 42,
        role: UserRole.USER
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + userId,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
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

  describe('When registering a new user', function () {
    const registrationPath = path + '/register'
    const baseCorrectParams = {
      username: 'user3',
      displayName: 'super user',
      email: 'test3@example.com',
      password: 'my super password'
    }

    it('Should fail with a too small username', async function () {
      const fields = { ...baseCorrectParams, username: '' }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = { ...baseCorrectParams, username: 'super'.repeat(50) }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = { ...baseCorrectParams, username: 'my username' }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { ...baseCorrectParams, email: 'test_example.com' }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = { ...baseCorrectParams, password: 'bla' }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = { ...baseCorrectParams, password: 'super'.repeat(61) }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail if we register a user with the same username', async function () {
      const fields = { ...baseCorrectParams, username: 'root' }

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail with a "peertube" username', async function () {
      const fields = { ...baseCorrectParams, username: 'peertube' }

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail if we register a user with the same email', async function () {
      const fields = { ...baseCorrectParams, email: 'admin' + server.internalServerNumber + '@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail with a bad display name', async function () {
      const fields = { ...baseCorrectParams, displayName: 'a'.repeat(150) }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel name', async function () {
      const fields = { ...baseCorrectParams, channel: { name: '[]azf', displayName: 'toto' } }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel display name', async function () {
      const fields = { ...baseCorrectParams, channel: { name: 'toto', displayName: '' } }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a channel name that is the same as username', async function () {
      const source = { username: 'super_user', channel: { name: 'super_user', displayName: 'display name' } }
      const fields = { ...baseCorrectParams, ...source }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an existing channel', async function () {
      const attributes = { name: 'existing_channel', displayName: 'hello', description: 'super description' }
      await server.channels.create({ attributes })

      const fields = { ...baseCorrectParams, channel: { name: 'existing_channel', displayName: 'toto' } }

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = { ...baseCorrectParams, channel: { name: 'super_channel', displayName: 'toto' } }

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields: fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should fail on a server with registration disabled', async function () {
      const fields = {
        username: 'user4',
        email: 'test4@example.com',
        password: 'my super password 4'
      }

      await makePostBodyRequest({
        url: serverWithRegistrationDisabled.url,
        path: registrationPath,
        token: serverWithRegistrationDisabled.accessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When registering multiple users on a server with users limit', function () {
    it('Should fail when after 3 registrations', async function () {
      await server.users.register({ username: 'user42', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })
  })

  describe('When asking a password reset', function () {
    const path = '/api/v1/users/ask-reset-password'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should success with the correct params', async function () {
      const fields = { email: 'admin@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When asking for an account verification email', function () {
    const path = '/api/v1/users/ask-send-verify-email'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = { email: 'admin@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server, serverWithRegistrationDisabled ])
  })
})
