/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, OAuth2ErrorCode, PeerTubeProblemDocument } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test oauth', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          max: 30
        }
      }
    })

    await setAccessTokensToServers([ server ])

    sqlCommand = new SQLCommand(server)
  })

  describe('OAuth client', function () {

    function expectInvalidClient (body: PeerTubeProblemDocument) {
      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_CLIENT)
      expect(body.detail).to.contain('client is invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_CLIENT)
    }

    it('Should create a new client')

    it('Should return the first client')

    it('Should remove the last client')

    it('Should not login with an invalid client id', async function () {
      const client = { id: 'client', secret: server.store.client.secret }
      const body = await server.login.login({ client, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expectInvalidClient(body)
    })

    it('Should not login with an invalid client secret', async function () {
      const client = { id: server.store.client.id, secret: 'coucou' }
      const body = await server.login.login({ client, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expectInvalidClient(body)
    })
  })

  describe('Login', function () {

    function expectInvalidCredentials (body: PeerTubeProblemDocument) {
      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_GRANT)
      expect(body.detail).to.contain('credentials are invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_GRANT)
    }

    it('Should not login with an invalid username', async function () {
      const user = { username: 'captain crochet', password: server.store.user.password }
      const body = await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expectInvalidCredentials(body)
    })

    it('Should not login with an invalid password', async function () {
      const user = { username: server.store.user.username, password: 'mew_three' }
      const body = await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expectInvalidCredentials(body)
    })

    it('Should be able to login', async function () {
      await server.login.login({ expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should be able to login with an insensitive username', async function () {
      const user = { username: 'RoOt', password: server.store.user.password }
      await server.login.login({ user, expectedStatus: HttpStatusCode.OK_200 })

      const user2 = { username: 'rOoT', password: server.store.user.password }
      await server.login.login({ user: user2, expectedStatus: HttpStatusCode.OK_200 })

      const user3 = { username: 'ROOt', password: server.store.user.password }
      await server.login.login({ user: user3, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('Logout', function () {

    it('Should logout (revoke token)', async function () {
      await server.login.logout({ token: server.accessToken })
    })

    it('Should not be able to get the user information', async function () {
      await server.users.getMyInfo({ expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to upload a video', async function () {
      await server.videos.upload({ attributes: { name: 'video' }, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should be able to login again', async function () {
      const body = await server.login.login()
      server.accessToken = body.access_token
      server.refreshToken = body.refresh_token
    })

    it('Should be able to get my user information again', async function () {
      await server.users.getMyInfo()
    })

    it('Should have an expired access token', async function () {
      this.timeout(60000)

      await sqlCommand.setTokenField(server.accessToken, 'accessTokenExpiresAt', new Date().toISOString())
      await sqlCommand.setTokenField(server.accessToken, 'refreshTokenExpiresAt', new Date().toISOString())

      await killallServers([ server ])
      await server.run()

      await server.users.getMyInfo({ expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to refresh an access token with an expired refresh token', async function () {
      await server.login.refreshToken({ refreshToken: server.refreshToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should refresh the token', async function () {
      this.timeout(50000)

      const futureDate = new Date(new Date().getTime() + 1000 * 60).toISOString()
      await sqlCommand.setTokenField(server.accessToken, 'refreshTokenExpiresAt', futureDate)

      await killallServers([ server ])
      await server.run()

      const res = await server.login.refreshToken({ refreshToken: server.refreshToken })
      server.accessToken = res.body.access_token
      server.refreshToken = res.body.refresh_token
    })

    it('Should be able to get my user information again', async function () {
      await server.users.getMyInfo()
    })
  })

  describe('Custom token lifetime', function () {
    before(async function () {
      this.timeout(120_000)

      await server.kill()
      await server.run({
        oauth2: {
          token_lifetime: {
            access_token: '2 seconds',
            refresh_token: '2 seconds'
          }
        }
      })
    })

    it('Should have a very short access token lifetime', async function () {
      this.timeout(50000)

      const { access_token: accessToken } = await server.login.login()
      await server.users.getMyInfo({ token: accessToken })

      await wait(3000)
      await server.users.getMyInfo({ token: accessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should have a very short refresh token lifetime', async function () {
      this.timeout(50000)

      const { refresh_token: refreshToken } = await server.login.login()
      await server.login.refreshToken({ refreshToken })

      await wait(3000)
      await server.login.refreshToken({ refreshToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  after(async function () {
    await sqlCommand.cleanup()
    await cleanupTests([ server ])
  })
})
