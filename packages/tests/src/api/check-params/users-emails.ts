/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test users API validators', function () {
  let server: PeerTubeServer

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {
      rates_limit: {
        ask_send_email: {
          max: 10
        }
      }
    })

    await setAccessTokensToServers([ server ])
    await server.config.enableSignup(true)

    await server.users.generate('moderator2', UserRole.MODERATOR)

    await server.registrations.requestRegistration({
      username: 'request1',
      registrationReason: 'tt'
    })
  })

  describe('When asking a password reset', function () {
    const path = '/api/v1/users/ask-reset-password'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = { email: 'admin@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When asking for an account verification email', function () {
    const path = '/api/v1/users/ask-send-verify-email'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = { email: 'admin@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When asking for a registration verification email', function () {
    const path = '/api/v1/users/registrations/ask-send-verify-email'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = { email: 'request1@example.com' }

      await makePostBodyRequest({
        url: server.url,
        path,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
