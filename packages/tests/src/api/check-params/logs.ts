/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test logs API validators', function () {
  const path = '/api/v1/server/logs'
  let server: PeerTubeServer
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    await server.users.create({ username: user.username, password: user.password })
    userAccessToken = await server.login.getAccessToken(user)
  })

  describe('When getting logs', function () {
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
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a missing startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad endDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), endDate: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad level parameter', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), level: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString() },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When listing audit logs', function () {
    const auditPath = '/api/v1/server/audit-logs'
    const listQuery = { format: 'list' }

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({ url: server.url, path: auditPath, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({ url: server.url, path: auditPath, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, auditPath, server.accessToken, listQuery)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, auditPath, server.accessToken, listQuery)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, auditPath, server.accessToken, listQuery)
    })

    it('Should fail with a bad format', async function () {
      await makeGetRequest({
        url: server.url,
        path: auditPath,
        token: server.accessToken,
        query: { format: 'toto', startDate: new Date().toISOString() },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail without a startDate with the default array format', async function () {
      for (const query of [ {}, { format: 'array' } ]) {
        await makeGetRequest({
          url: server.url,
          path: auditPath,
          token: server.accessToken,
          query,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }
    })

    it('Should fail with bad filters', async function () {
      const queries = [
        { entityType: 'toto' },
        { action: 'toto' },
        { entityId: 'toto' },
        { startDate: 'toto' },
        { endDate: 'toto' }
      ]

      for (const query of queries) {
        await makeGetRequest({
          url: server.url,
          path: auditPath,
          token: server.accessToken,
          query: { ...listQuery, ...query },
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      // List format doesn't require a start date
      await makeGetRequest({
        url: server.url,
        path: auditPath,
        token: server.accessToken,
        query: listQuery,
        expectedStatus: HttpStatusCode.OK_200
      })

      await makeGetRequest({
        url: server.url,
        path: auditPath,
        token: server.accessToken,
        query: { startDate: new Date(0).toISOString() },
        expectedStatus: HttpStatusCode.OK_200
      })

      await makeGetRequest({
        url: server.url,
        path: auditPath,
        token: server.accessToken,
        query: {
          format: 'list',
          start: 0,
          count: 10,
          sort: '-createdAt',
          search: 'root',
          entityType: 'video',
          entityId: 1,
          action: 'update',
          startDate: new Date(0).toISOString(),
          endDate: new Date().toISOString()
        },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When creating client logs', function () {
    const base = {
      level: 'warn' as 'warn',
      message: 'my super message',
      url: 'https://example.com/toto'
    }
    const expectedStatus = HttpStatusCode.BAD_REQUEST_400

    it('Should fail with an invalid level', async function () {
      await server.logs.createLogClient({ payload: { ...base, level: '' as any }, expectedStatus })
      await server.logs.createLogClient({ payload: { ...base, level: undefined }, expectedStatus })
      await server.logs.createLogClient({ payload: { ...base, level: 'toto' as any }, expectedStatus })
    })

    it('Should fail with an invalid message', async function () {
      await server.logs.createLogClient({ payload: { ...base, message: undefined }, expectedStatus })
      await server.logs.createLogClient({ payload: { ...base, message: '' }, expectedStatus })
      await server.logs.createLogClient({ payload: { ...base, message: 'm'.repeat(2500) }, expectedStatus })
    })

    it('Should fail with an invalid url', async function () {
      await server.logs.createLogClient({ payload: { ...base, url: undefined }, expectedStatus })
      await server.logs.createLogClient({ payload: { ...base, url: 'toto' }, expectedStatus })
    })

    it('Should fail with an invalid stackTrace', async function () {
      await server.logs.createLogClient({ payload: { ...base, stackTrace: 's'.repeat(20000) }, expectedStatus })
    })

    it('Should fail with an invalid userAgent', async function () {
      await server.logs.createLogClient({ payload: { ...base, userAgent: 's'.repeat(500) }, expectedStatus })
    })

    it('Should fail with an invalid meta', async function () {
      await server.logs.createLogClient({ payload: { ...base, meta: 's'.repeat(20000) }, expectedStatus })
    })

    it('Should succeed with the correct params', async function () {
      await server.logs.createLogClient({ payload: { ...base, stackTrace: 'stackTrace', meta: '{toto}', userAgent: 'userAgent' } })
    })

    it('Should rate limit log creation', async function () {
      let fail = false

      for (let i = 0; i < 100; i++) {
        try {
          await server.logs.createLogClient({ token: null, payload: base })
        } catch {
          fail = true
        }
      }

      expect(fail).to.be.true
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
