/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { omit } from 'lodash'
import { join } from 'path'
import { User, UserRole, VideoImport, VideoImportState } from '../../../../shared'
import {
  addVideoChannel,
  blockUser,
  cleanupTests,
  createUser,
  deleteMe,
  flushAndRunServer,
  getMyUserInformation,
  getMyUserVideoRating,
  getUsersList,
  immutableAssign,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  registerUser,
  removeUser,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  unblockUser,
  updateUser,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { getMagnetURI, getMyVideoImports, getGoodVideoUrl, importVideo } from '../../../../shared/extra-utils/videos/video-imports'
import { UserAdminFlag } from '../../../../shared/models/users/user-flag.model'
import { VideoPrivacy } from '../../../../shared/models/videos'

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let moderatorId: number
  let videoId: number
  let server: ServerInfo
  let serverWithRegistrationDisabled: ServerInfo
  let userAccessToken = ''
  let moderatorAccessToken = ''
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
        flushAndRunServer(1, overrideConfig),
        flushAndRunServer(2)
      ])

      server = res[0]
      serverWithRegistrationDisabled = res[1]

      await setAccessTokensToServers([ server ])
    }

    {
      const user = {
        username: 'user1',
        password: 'my super password'
      }

      const videoQuota = 42000000
      await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: user.username,
        password: user.password,
        videoQuota: videoQuota
      })
      userAccessToken = await userLogin(server, user)
    }

    {
      const moderator = {
        username: 'moderator1',
        password: 'super password'
      }

      await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: moderator.username,
        password: moderator.password,
        role: UserRole.MODERATOR
      })

      moderatorAccessToken = await userLogin(server, moderator)
    }

    {
      const moderator = {
        username: 'moderator2',
        password: 'super password'
      }

      await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: moderator.username,
        password: moderator.password,
        role: UserRole.MODERATOR
      })
    }

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      videoId = res.body.video.id
    }

    {
      const res = await getUsersList(server.url, server.accessToken)
      const users: User[] = res.body.data

      userId = users.find(u => u.username === 'user1').id
      rootId = users.find(u => u.username === 'root').id
      moderatorId = users.find(u => u.username === 'moderator2').id
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

    it('Should fail with a bad blocked/banned user filter', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: {
          blocked: 42
        },
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
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
      const fields = immutableAssign(baseCorrectParams, { username: '' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'super'.repeat(50) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a not lowercase username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'Toto' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my username' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'test_example.com' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'bla' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with empty password and no smtp configured', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: '' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with no password on a server with smtp enabled', async function () {
      this.timeout(10000)

      killallServers([ server ])

      const config = immutableAssign(overrideConfig, {
        smtp: {
          hostname: 'localhost',
          port: emailPort
        }
      })
      await reRunServer(server, config)

      const fields = immutableAssign(baseCorrectParams, {
        password: '',
        username: 'create_password',
        email: 'create_password@example.com'
      })

      await makePostBodyRequest({
        url: server.url,
        path: path,
        token: server.accessToken,
        fields,
        statusCodeExpected: 200
      })
    })

    it('Should fail with invalid admin flags', async function () {
      const fields = immutableAssign(baseCorrectParams, { adminFlags: 'toto' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: 'super token',
        fields: baseCorrectParams,
        statusCodeExpected: 401
      })
    })

    it('Should fail if we add a user with the same username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'user1' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail if we add a user with the same email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'user1@example.com' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
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
      const fields = immutableAssign(baseCorrectParams, { videoQuota: -5 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuotaDaily', async function () {
      const fields = immutableAssign(baseCorrectParams, { videoQuotaDaily: -7 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a user role', async function () {
      const fields = omit(baseCorrectParams, 'role')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role', async function () {
      const fields = immutableAssign(baseCorrectParams, { role: 88989 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a "peertube" username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'peertube' })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should fail to create a moderator or an admin with a moderator', async function () {
      for (const role of [ UserRole.MODERATOR, UserRole.ADMINISTRATOR ]) {
        const fields = immutableAssign(baseCorrectParams, { role })

        await makePostBodyRequest({
          url: server.url,
          path,
          token: moderatorAccessToken,
          fields,
          statusCodeExpected: 403
        })
      }
    })

    it('Should succeed to create a user with a moderator', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'a4656', email: 'a4656@example.com', role: UserRole.USER })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: moderatorAccessToken,
        fields,
        statusCodeExpected: 200
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 200
      })
    })

    it('Should fail with a non admin user', async function () {
      const user = {
        username: 'user1',
        password: 'my super password'
      }
      userAccessToken = await userLogin(server, user)

      const fields = {
        username: 'user3',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: 42000000
      }
      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 })
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
        currentPassword: 'my super password',
        password: 'bla'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        currentPassword: 'my super password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail without the current password', async function () {
      const fields = {
        currentPassword: 'my super password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid current password', async function () {
      const fields = {
        currentPassword: 'my super password fail',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 401 })
    })

    it('Should fail with an invalid NSFW policy attribute', async function () {
      const fields = {
        nsfwPolicy: 'hello'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid autoPlayVideo attribute', async function () {
      const fields = {
        autoPlayVideo: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid autoPlayNextVideo attribute', async function () {
      const fields = {
        autoPlayNextVideo: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid videosHistoryEnabled attribute', async function () {
      const fields = {
        videosHistoryEnabled: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        currentPassword: 'my super password',
        password: 'my super password'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: 'super token', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a too long description', async function () {
      const fields = {
        description: 'super'.repeat(201)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid videoLanguages attribute', async function () {
      {
        const fields = {
          videoLanguages: 'toto'
        }

        await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
      }

      {
        const languages = []
        for (let i = 0; i < 1000; i++) {
          languages.push('fr')
        }

        const fields = {
          videoLanguages: languages
        }

        await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
      }
    })

    it('Should fail with an invalid theme', async function () {
      const fields = { theme: 'invalid' }
      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an unknown theme', async function () {
      const fields = { theme: 'peertube-theme-unknown' }
      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid noInstanceConfigWarningModal attribute', async function () {
      const fields = {
        noInstanceConfigWarningModal: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid noWelcomeModal attribute', async function () {
      const fields = {
        noWelcomeModal: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should succeed to change password with the correct params', async function () {
      const fields = {
        currentPassword: 'my super password',
        password: 'my super password',
        nsfwPolicy: 'blur',
        autoPlayVideo: false,
        email: 'super_email@example.com',
        theme: 'default',
        noInstanceConfigWarningModal: true,
        noWelcomeModal: true
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 })
    })

    it('Should succeed without password change with the correct params', async function () {
      const fields = {
        nsfwPolicy: 'blur',
        autoPlayVideo: false
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating my avatar', function () {
    it('Should fail without an incorrect input file', async function () {
      const fields = {}
      const attaches = {
        avatarfile: join(__dirname, '..', '..', 'fixtures', 'video_short.mp4')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big file', async function () {
      const fields = {}
      const attaches = {
        avatarfile: join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with an unauthenticated user', async function () {
      const fields = {}
      const attaches = {
        avatarfile: join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/me/avatar/pick',
        fields,
        attaches,
        statusCodeExpected: 401
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {}
      const attaches = {
        avatarfile: join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/me/avatar/pick',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 200
      })
    })
  })

  describe('When getting a user', function () {

    it('Should fail with an non authenticated user', async function () {
      await makeGetRequest({ url: server.url, path: path + userId, token: 'super token', statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path: path + userId, token: server.accessToken, statusCodeExpected: 200 })
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
        currentPassword: 'my super password',
        password: 'bla'
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        currentPassword: 'my super password',
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: 'super token', fields, statusCodeExpected: 401 })
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
        token: moderatorAccessToken,
        fields,
        statusCodeExpected: 403
      })
    })

    it('Should succeed to update a user with a moderator', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({
        url: server.url,
        path: path + userId,
        token: moderatorAccessToken,
        fields,
        statusCodeExpected: 204
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        email: 'email@example.com',
        emailVerified: true,
        videoQuota: 42,
        role: UserRole.USER
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When getting my information', function () {
    it('Should fail with a non authenticated user', async function () {
      await getMyUserInformation(server.url, 'fake_token', 401)
    })

    it('Should success with the correct parameters', async function () {
      await getMyUserInformation(server.url, userAccessToken)
    })
  })

  describe('When getting my video rating', function () {
    it('Should fail with a non authenticated user', async function () {
      await getMyUserVideoRating(server.url, 'fake_token', videoId, 401)
    })

    it('Should fail with an incorrect video uuid', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, 'blabla', 400)
    })

    it('Should fail with an unknown video', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, '4da6fde3-88f7-4d16-b119-108df5630b06', 404)
    })

    it('Should succeed with the correct parameters', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, videoId)
    })
  })

  describe('When retrieving my global ratings', function () {
    const path = '/api/v1/accounts/user1/ratings'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userAccessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userAccessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, userAccessToken)
    })

    it('Should fail with a unauthenticated user', async function () {
      await makeGetRequest({ url: server.url, path, statusCodeExpected: 401 })
    })

    it('Should fail with a another user', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, statusCodeExpected: 403 })
    })

    it('Should fail with a bad type', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, query: { rating: 'toto ' }, statusCodeExpected: 400 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 200 })
    })
  })

  describe('When blocking/unblocking/removing user', function () {
    it('Should fail with an incorrect id', async function () {
      await removeUser(server.url, 'blabla', server.accessToken, 400)
      await blockUser(server.url, 'blabla', server.accessToken, 400)
      await unblockUser(server.url, 'blabla', server.accessToken, 400)
    })

    it('Should fail with the root user', async function () {
      await removeUser(server.url, rootId, server.accessToken, 400)
      await blockUser(server.url, rootId, server.accessToken, 400)
      await unblockUser(server.url, rootId, server.accessToken, 400)
    })

    it('Should return 404 with a non existing id', async function () {
      await removeUser(server.url, 4545454, server.accessToken, 404)
      await blockUser(server.url, 4545454, server.accessToken, 404)
      await unblockUser(server.url, 4545454, server.accessToken, 404)
    })

    it('Should fail with a non admin user', async function () {
      await removeUser(server.url, userId, userAccessToken, 403)
      await blockUser(server.url, userId, userAccessToken, 403)
      await unblockUser(server.url, userId, userAccessToken, 403)
    })

    it('Should fail on a moderator with a moderator', async function () {
      await removeUser(server.url, moderatorId, moderatorAccessToken, 403)
      await blockUser(server.url, moderatorId, moderatorAccessToken, 403)
      await unblockUser(server.url, moderatorId, moderatorAccessToken, 403)
    })

    it('Should succeed on a user with a moderator', async function () {
      await blockUser(server.url, userId, moderatorAccessToken)
      await unblockUser(server.url, userId, moderatorAccessToken)
    })
  })

  describe('When deleting our account', function () {
    it('Should fail with with the root account', async function () {
      await deleteMe(server.url, server.accessToken, 400)
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
      const fields = immutableAssign(baseCorrectParams, { username: '' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'super'.repeat(50) })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my username' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'test_example.com' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'bla' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail if we register a user with the same username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'root' })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should fail with a "peertube" username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'peertube' })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should fail if we register a user with the same email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'admin' + server.internalServerNumber + '@example.com' })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should fail with a bad display name', async function () {
      const fields = immutableAssign(baseCorrectParams, { displayName: 'a'.repeat(150) })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel name', async function () {
      const fields = immutableAssign(baseCorrectParams, { channel: { name: '[]azf', displayName: 'toto' } })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel display name', async function () {
      const fields = immutableAssign(baseCorrectParams, { channel: { name: 'toto', displayName: '' } })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a channel name that is the same as username', async function () {
      const source = { username: 'super_user', channel: { name: 'super_user', displayName: 'display name' } }
      const fields = immutableAssign(baseCorrectParams, source)

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an existing channel', async function () {
      const videoChannelAttributesArg = { name: 'existing_channel', displayName: 'hello', description: 'super description' }
      await addVideoChannel(server.url, server.accessToken, videoChannelAttributesArg)

      const fields = immutableAssign(baseCorrectParams, { channel: { name: 'existing_channel', displayName: 'toto' } })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should succeed with the correct params', async function () {
      const fields = immutableAssign(baseCorrectParams, { channel: { name: 'super_channel', displayName: 'toto' } })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields: fields,
        statusCodeExpected: 204
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
        statusCodeExpected: 403
      })
    })
  })

  describe('When registering multiple users on a server with users limit', function () {
    it('Should fail when after 3 registrations', async function () {
      await registerUser(server.url, 'user42', 'super password', 403)
    })
  })

  describe('When having a video quota', function () {
    it('Should fail with a user having too many videos', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, 403)
    })

    it('Should fail with a registered user having too many videos', async function () {
      this.timeout(30000)

      const user = {
        username: 'user3',
        password: 'my super password'
      }
      userAccessToken = await userLogin(server, user)

      const videoAttributes = { fixture: 'video_short2.webm' }
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes, 403)
    })

    it('Should fail to import with HTTP/Torrent/magnet', async function () {
      this.timeout(120000)

      const baseAttributes = {
        channelId: 1,
        privacy: VideoPrivacy.PUBLIC
      }
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { targetUrl: getGoodVideoUrl() }))
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { magnetUri: getMagnetURI() }))
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { torrentfile: 'video-720p.torrent' as any }))

      await waitJobs([ server ])

      const res = await getMyVideoImports(server.url, server.accessToken)

      expect(res.body.total).to.equal(3)
      const videoImports: VideoImport[] = res.body.data
      expect(videoImports).to.have.lengthOf(3)

      for (const videoImport of videoImports) {
        expect(videoImport.state.id).to.equal(VideoImportState.FAILED)
        expect(videoImport.error).not.to.be.undefined
        expect(videoImport.error).to.contain('user video quota is exceeded')
      }
    })
  })

  describe('When having a daily video quota', function () {
    it('Should fail with a user having too many videos', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuotaDaily: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, 403)
    })
  })

  describe('When having an absolute and daily video quota', function () {
    it('Should fail if exceeding total quota', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 42,
        videoQuotaDaily: 1024 * 1024 * 1024
      })

      await uploadVideo(server.url, server.accessToken, {}, 403)
    })

    it('Should fail if exceeding daily quota', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 1024 * 1024 * 1024,
        videoQuotaDaily: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, 403)
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

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
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

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server, serverWithRegistrationDisabled ])
  })
})
