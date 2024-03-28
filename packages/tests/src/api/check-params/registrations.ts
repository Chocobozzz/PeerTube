import { omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType, UserRole } from '@peertube/peertube-models'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import {
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar
} from '@peertube/peertube-server-commands'

describe('Test registrations API validators', function () {
  let server: PeerTubeServer
  let userToken: string
  let moderatorToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])
    await setDefaultChannelAvatar([ server ])

    await server.config.enableSignup(false);

    ({ token: moderatorToken } = await server.users.generate('moderator', UserRole.MODERATOR));
    ({ token: userToken } = await server.users.generate('user', UserRole.USER))
  })

  describe('Register', function () {
    const registrationPath = '/api/v1/users/register'
    const registrationRequestPath = '/api/v1/users/registrations/request'

    const baseCorrectParams = {
      username: 'user3',
      displayName: 'super user',
      email: 'test3@example.com',
      password: 'my super password',
      registrationReason: 'my super registration reason'
    }

    describe('When registering a new user or requesting user registration', function () {

      async function check (fields: any, expectedStatus: HttpStatusCodeType = HttpStatusCode.BAD_REQUEST_400) {
        await server.config.enableSignup(false)
        await makePostBodyRequest({ url: server.url, path: registrationPath, fields, expectedStatus })

        await server.config.enableSignup(true)
        await makePostBodyRequest({ url: server.url, path: registrationRequestPath, fields, expectedStatus })
      }

      it('Should fail with a too small username', async function () {
        const fields = { ...baseCorrectParams, username: '' }

        await check(fields)
      })

      it('Should fail with a too long username', async function () {
        const fields = { ...baseCorrectParams, username: 'super'.repeat(50) }

        await check(fields)
      })

      it('Should fail with an incorrect username', async function () {
        const fields = { ...baseCorrectParams, username: 'my username' }

        await check(fields)
      })

      it('Should fail with a missing email', async function () {
        const fields = omit(baseCorrectParams, [ 'email' ])

        await check(fields)
      })

      it('Should fail with an invalid email', async function () {
        const fields = { ...baseCorrectParams, email: 'test_example.com' }

        await check(fields)
      })

      it('Should fail with a too small password', async function () {
        const fields = { ...baseCorrectParams, password: 'bla' }

        await check(fields)
      })

      it('Should fail with a too long password', async function () {
        const fields = { ...baseCorrectParams, password: 'super'.repeat(61) }

        await check(fields)
      })

      it('Should fail if we register a user with the same username', async function () {
        const fields = { ...baseCorrectParams, username: 'root' }

        await check(fields, HttpStatusCode.CONFLICT_409)
      })

      it('Should fail with a "peertube" username', async function () {
        const fields = { ...baseCorrectParams, username: 'peertube' }

        await check(fields, HttpStatusCode.CONFLICT_409)
      })

      it('Should fail if we register a user with the same email', async function () {
        const fields = { ...baseCorrectParams, email: 'admin' + server.internalServerNumber + '@example.com' }

        await check(fields, HttpStatusCode.CONFLICT_409)
      })

      it('Should fail with a bad display name', async function () {
        const fields = { ...baseCorrectParams, displayName: 'a'.repeat(150) }

        await check(fields)
      })

      it('Should fail with a bad channel name', async function () {
        const fields = { ...baseCorrectParams, channel: { name: '[]azf', displayName: 'toto' } }

        await check(fields)
      })

      it('Should fail with a bad channel display name', async function () {
        const fields = { ...baseCorrectParams, channel: { name: 'toto', displayName: '' } }

        await check(fields)
      })

      it('Should fail with a channel name that is the same as username', async function () {
        const source = { username: 'super_user', channel: { name: 'super_user', displayName: 'display name' } }
        const fields = { ...baseCorrectParams, ...source }

        await check(fields)
      })

      it('Should fail with an existing channel', async function () {
        const attributes = { name: 'existing_channel', displayName: 'hello', description: 'super description' }
        await server.channels.create({ attributes })

        const fields = { ...baseCorrectParams, channel: { name: 'existing_channel', displayName: 'toto' } }

        await check(fields, HttpStatusCode.CONFLICT_409)
      })

      it('Should fail on a server with registration disabled', async function () {
        this.timeout(60000)

        await server.config.updateExistingConfig({
          newConfig: {
            signup: {
              enabled: false
            }
          }
        })

        await server.registrations.register({ username: 'user4', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        await server.registrations.requestRegistration({
          username: 'user4',
          registrationReason: 'reason',
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail if the user limit is reached', async function () {
        this.timeout(60000)

        const { total } = await server.users.list()

        await server.config.enableSignup(false, total)
        await server.registrations.register({ username: 'user42', expectedStatus: HttpStatusCode.FORBIDDEN_403 })

        await server.config.enableSignup(true, total)
        await server.registrations.requestRegistration({
          username: 'user42',
          registrationReason: 'reason',
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should succeed if the user limit is not reached', async function () {
        this.timeout(60000)

        const { total } = await server.users.list()

        await server.config.enableSignup(false, total + 1)
        await server.registrations.register({ username: 'user43', expectedStatus: HttpStatusCode.NO_CONTENT_204 })

        await server.config.enableSignup(true, total + 2)
        await server.registrations.requestRegistration({
          username: 'user44',
          registrationReason: 'reason',
          expectedStatus: HttpStatusCode.OK_200
        })
      })
    })

    describe('On direct registration', function () {

      it('Should succeed with the correct params', async function () {
        await server.config.enableSignup(false)

        const fields = {
          username: 'user_direct_1',
          displayName: 'super user direct 1',
          email: 'user_direct_1@example.com',
          password: 'my super password',
          channel: { name: 'super_user_direct_1_channel', displayName: 'super user direct 1 channel' }
        }

        await makePostBodyRequest({ url: server.url, path: registrationPath, fields, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
      })

      it('Should fail if the instance requires approval', async function () {
        this.timeout(60000)

        await server.config.enableSignup(true)
        await server.registrations.register({ username: 'user42', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })
    })

    describe('On registration request', function () {

      before(async function () {
        this.timeout(60000)

        await server.config.enableSignup(true)
      })

      it('Should fail with an invalid registration reason', async function () {
        for (const registrationReason of [ '', 't', 't'.repeat(5000) ]) {
          await server.registrations.requestRegistration({
            username: 'user_request_1',
            registrationReason,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        }
      })

      it('Should succeed with the correct params', async function () {
        await server.registrations.requestRegistration({
          username: 'user_request_2',
          registrationReason: 'tt',
          channel: {
            displayName: 'my user request 2 channel',
            name: 'user_request_2_channel'
          }
        })
      })

      it('Should fail if the username is already awaiting registration approval', async function () {
        await server.registrations.requestRegistration({
          username: 'user_request_2',
          registrationReason: 'tt',
          channel: {
            displayName: 'my user request 42 channel',
            name: 'user_request_42_channel'
          },
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })

      it('Should fail if the email is already awaiting registration approval', async function () {
        await server.registrations.requestRegistration({
          username: 'user42',
          email: 'user_request_2@example.com',
          registrationReason: 'tt',
          channel: {
            displayName: 'my user request 42 channel',
            name: 'user_request_42_channel'
          },
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })

      it('Should fail if the channel is already awaiting registration approval', async function () {
        await server.registrations.requestRegistration({
          username: 'user42',
          registrationReason: 'tt',
          channel: {
            displayName: 'my user request 2 channel',
            name: 'user_request_2_channel'
          },
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })

      it('Should fail if the instance does not require approval', async function () {
        this.timeout(60000)

        await server.config.enableSignup(false)

        await server.registrations.requestRegistration({
          username: 'user42',
          registrationReason: 'toto',
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })
    })
  })

  describe('Registrations accept/reject', function () {
    let id1: number
    let id2: number

    before(async function () {
      this.timeout(60000)

      await server.config.enableSignup(true);

      ({ id: id1 } = await server.registrations.requestRegistration({ username: 'request_2', registrationReason: 'toto' }));
      ({ id: id2 } = await server.registrations.requestRegistration({ username: 'request_3', registrationReason: 'toto' }))
    })

    it('Should fail to accept/reject registration without token', async function () {
      const options = { id: id1, moderationResponse: 'tt', token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 }
      await server.registrations.accept(options)
      await server.registrations.reject(options)
    })

    it('Should fail to accept/reject registration with a non moderator user', async function () {
      const options = { id: id1, moderationResponse: 'tt', token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 }
      await server.registrations.accept(options)
      await server.registrations.reject(options)
    })

    it('Should fail to accept/reject registration with a bad registration id', async function () {
      {
        const options = { id: 't' as any, moderationResponse: 'tt', token: moderatorToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 }
        await server.registrations.accept(options)
        await server.registrations.reject(options)
      }

      {
        const options = { id: 42, moderationResponse: 'tt', token: moderatorToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 }
        await server.registrations.accept(options)
        await server.registrations.reject(options)
      }
    })

    it('Should fail to accept/reject registration with a bad moderation resposne', async function () {
      for (const moderationResponse of [ '', 't', 't'.repeat(5000) ]) {
        const options = { id: id1, moderationResponse, token: moderatorToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 }
        await server.registrations.accept(options)
        await server.registrations.reject(options)
      }
    })

    it('Should succeed to accept a registration', async function () {
      await server.registrations.accept({ id: id1, moderationResponse: 'tt', token: moderatorToken })
    })

    it('Should succeed to reject a registration', async function () {
      await server.registrations.reject({ id: id2, moderationResponse: 'tt', token: moderatorToken })
    })

    it('Should fail to accept/reject a registration that was already accepted/rejected', async function () {
      for (const id of [ id1, id2 ]) {
        const options = { id, moderationResponse: 'tt', token: moderatorToken, expectedStatus: HttpStatusCode.CONFLICT_409 }
        await server.registrations.accept(options)
        await server.registrations.reject(options)
      }
    })
  })

  describe('Registrations deletion', function () {
    let id1: number
    let id2: number
    let id3: number

    before(async function () {
      ({ id: id1 } = await server.registrations.requestRegistration({ username: 'request_4', registrationReason: 'toto' }));
      ({ id: id2 } = await server.registrations.requestRegistration({ username: 'request_5', registrationReason: 'toto' }));
      ({ id: id3 } = await server.registrations.requestRegistration({ username: 'request_6', registrationReason: 'toto' }))

      await server.registrations.accept({ id: id2, moderationResponse: 'tt' })
      await server.registrations.reject({ id: id3, moderationResponse: 'tt' })
    })

    it('Should fail to delete registration without token', async function () {
      await server.registrations.delete({ id: id1, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail to delete registration with a non moderator user', async function () {
      await server.registrations.delete({ id: id1, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail to delete registration with a bad registration id', async function () {
      await server.registrations.delete({ id: 't' as any, token: moderatorToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.registrations.delete({ id: 42, token: moderatorToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await server.registrations.delete({ id: id1, token: moderatorToken })
      await server.registrations.delete({ id: id2, token: moderatorToken })
      await server.registrations.delete({ id: id3, token: moderatorToken })
    })
  })

  describe('Listing registrations', function () {
    const path = '/api/v1/users/registrations'

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
      await server.registrations.list({
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await server.registrations.list({
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await server.registrations.list({
        token: moderatorToken,
        search: 'toto'
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
