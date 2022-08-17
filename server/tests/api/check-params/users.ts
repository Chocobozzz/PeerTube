/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { MockSmtpServer } from '@server/tests/shared'
import { omit } from '@shared/core-utils'
import { HttpStatusCode, UserRole } from '@shared/models'
import { cleanupTests, createSingleServer, makePostBodyRequest, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let server: PeerTubeServer
  let serverWithRegistrationDisabled: PeerTubeServer

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    const res = await Promise.all([
      createSingleServer(1, { signup: { limit: 3 } }),
      createSingleServer(2)
    ])

    server = res[0]
    serverWithRegistrationDisabled = res[1]

    await setAccessTokensToServers([ server ])

    await server.users.generate('moderator2', UserRole.MODERATOR)
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
      const fields = omit(baseCorrectParams, [ 'email' ])

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
        fields,
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
