/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
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
