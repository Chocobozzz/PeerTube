/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { MockCoreBlocklist } from '@tests/shared/mock-servers/mock-core-blocklist.js'

describe('Test blocklist subscriptions API validators', function () {
  let server: PeerTubeServer
  let mockServer: MockCoreBlocklist
  let mockPort: number
  let userAccessToken: string

  before(async function () {
    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    mockServer = new MockCoreBlocklist()
    mockPort = await mockServer.initialize()

    userAccessToken = await server.users.generateUserAndToken('user1')
  })

  describe('When managing blocklist subscriptions', function () {
    const path = '/api/v1/server/blocklist/subscriptions'

    describe('When listing subscriptions', function () {
      it('Should fail with an unauthenticated user', async function () {
        await server.blocklist.listServerBlocklistSubscriptions({
          token: null,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail with a user without the appropriate rights', async function () {
        await server.blocklist.listServerBlocklistSubscriptions({
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path, server.accessToken)
      })

      it('Should fail with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path, server.accessToken)
      })

      it('Should fail with an incorrect sort', async function () {
        await checkBadSort(server.url, path, server.accessToken)
      })

      it('Should succeed with valid params', async function () {
        await server.blocklist.listServerBlocklistSubscriptions()
      })
    })

    describe('When adding subscriptions', function () {
      it('Should fail with an unauthenticated user', async function () {
        await server.blocklist.addServerBlocklistSubscription({
          token: null,
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail with a user without the appropriate rights', async function () {
        await server.blocklist.addServerBlocklistSubscription({
          token: userAccessToken,
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid URL', async function () {
        await server.blocklist.addServerBlocklistSubscription({
          subscriptionUrl: 'invalid',
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an URL that does not have the right format', async function () {
        await server.blocklist.addServerBlocklistSubscription({
          subscriptionUrl: `http://127.0.0.1:${mockPort}/invalid-blocklist-1`,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })

        await server.blocklist.addServerBlocklistSubscription({
          subscriptionUrl: `http://127.0.0.1:${mockPort}/invalid-blocklist-2`,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should succeed with valid params', async function () {
        await server.blocklist.addServerBlocklistSubscription({ subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json` })
      })

      it('Should fail with an already existing URL', async function () {
        await server.blocklist.addServerBlocklistSubscription({
          subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`,
          expectedStatus: HttpStatusCode.CONFLICT_409
        })
      })
    })

    describe('When deleting subscriptions', function () {
      let subscriptionId: number

      before(async function () {
        const { data } = await server.blocklist.listServerBlocklistSubscriptions()
        subscriptionId = data[0].id
      })

      it('Should fail with an unauthenticated user', async function () {
        await server.blocklist.removeServerBlocklistSubscription({
          token: null,
          id: subscriptionId,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail with a user without the appropriate rights', async function () {
        await server.blocklist.removeServerBlocklistSubscription({
          token: userAccessToken,
          id: subscriptionId,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid id', async function () {
        await server.blocklist.removeServerBlocklistSubscription({
          id: 'invalid',
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an unknown id', async function () {
        await server.blocklist.removeServerBlocklistSubscription({
          id: 999999,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })

      it('Should succeed with valid params', async function () {
        await server.blocklist.removeServerBlocklistSubscription({ id: subscriptionId })
      })
    })
  })

  describe('When listing public blocklist log', function () {
    it('Should fail if not enabled by the config', async function () {
      await server.blocklist.listServerPublicBlocklistLog({
        startDate: new Date().toISOString(),
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid start date', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          blocklist: {
            publicLog: {
              enabled: true
            }
          }
        }
      })

      await server.blocklist.listServerPublicBlocklistLog({
        startDate: 'invalid-date',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      await server.blocklist.listServerPublicBlocklistLog({ startDate: new Date().toISOString() })
      await server.blocklist.listServerPublicBlocklistLog()
    })

    it('Should fail again when disabled in config', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          blocklist: {
            publicLog: {
              enabled: false
            }
          }
        }
      })

      await server.blocklist.listServerPublicBlocklistLog({
        startDate: new Date().toISOString(),
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])

    await mockServer.terminate()
  })
})
