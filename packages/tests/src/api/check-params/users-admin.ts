/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserAdminFlag, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test users admin API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let moderatorId: number
  let server: PeerTubeServer
  let userToken = ''
  let moderatorToken = ''
  let emailPort: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    const emails: object[] = []
    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

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
      const fields = omit(baseCorrectParams, [ 'email' ])

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

      await server.run(ConfigCommand.getEmailOverrideConfig(emailPort))

      const fields = {
        ...baseCorrectParams,

        password: '',
        username: 'create_password',
        email: 'create_password@example.com'
      }

      await makePostBodyRequest({
        url: server.url,
        path,
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
        token: 'supertoken',
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
      const emails = [
        'user1@example.com',
        'uSer1@example.com'
      ]

      for (const email of emails) {
        const fields = { ...baseCorrectParams, email }

        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      }
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
      const fields = omit(baseCorrectParams, [ 'role' ])

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

  describe('When getting a user', function () {

    it('Should fail with an non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + userId,
        token: 'supertoken',
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

    it('Should fail with an existing email attribute', async function () {
      const fields = { email: 'modeRator1@example.com' }

      await makePutBodyRequest({
        url: server.url,
        path: path + userId,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
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
        token: 'supertoken',
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

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
