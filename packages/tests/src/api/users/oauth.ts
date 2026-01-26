/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, MyUser, OAuth2ErrorCode, PeerTubeProblemDocument } from '@peertube/peertube-models'
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

    await server.users.create({ username: 'user1', email: 'user@example.com' })
    await server.users.create({ username: 'user2', password: 'AdvancedPassword' })

    await sqlCommand.setUserEmail('user2', 'User@example.com')
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

      const user = { username: 'User@example.com', password: 'AdvancedPassword' }
      await server.login.login({ user, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should be able to login with an insensitive username', async function () {
      const user = { username: 'RoOt', password: server.store.user.password }
      await server.login.login({ user, expectedStatus: HttpStatusCode.OK_200 })

      const user2 = { username: 'rOoT', password: server.store.user.password }
      await server.login.login({ user: user2, expectedStatus: HttpStatusCode.OK_200 })

      const user3 = { username: 'ROOt', password: server.store.user.password }
      await server.login.login({ user: user3, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should be able to login with an insensitive email when no similar emails exist', async function () {
      const user = { username: 'ADMIN' + server.internalServerNumber + '@example.com', password: server.store.user.password }
      await server.login.login({ user, expectedStatus: HttpStatusCode.OK_200 })

      const user2 = { username: 'admin' + server.internalServerNumber + '@example.com', password: server.store.user.password }
      await server.login.login({ user: user2, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should not be able to login with an insensitive email when similar emails exist', async function () {
      const user = { username: 'uSer@example.com', password: 'AdvancedPassword' }
      await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      const user2 = { username: 'User@example.com', password: 'AdvancedPassword' }
      await server.login.login({ user: user2, expectedStatus: HttpStatusCode.OK_200 })
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

  describe('Token sessions', function () {
    let user10: MyUser
    let user10Token: string
    let user10Token2: string

    let user20: MyUser
    let user20Token: string
    let user20RefreshToken: string

    const beforeAllDate = new Date().getTime()

    before(async function () {
      this.timeout(120_000)

      {
        await server.users.create({ username: 'user10', password: 'password' })

        const res = await server.login.login({
          user: { username: 'user10', password: 'password' },
          userAgent: 'web',
          xForwardedFor: '0.0.0.42,127.0.0.1'
        })

        user10Token = res.access_token
      }

      {
        await server.users.create({ username: 'user20', password: 'password' })

        const res = await server.login.login({
          user: { username: 'user20', password: 'password' }
        })

        user20Token = res.access_token
        user20RefreshToken = res.refresh_token
        user20 = await server.users.getMyInfo({ token: user20Token })
      }
    })

    it('Should create multiple token sessions', async function () {
      user10Token2 = await server.login.getAccessToken({ username: 'user10', password: 'password' })
      await server.login.getAccessToken({ username: 'user10', password: 'password' })

      user10 = await server.users.getMyInfo({ token: user10Token2 })

      await wait(2000)
    })

    it('Should list sessions of a user', async function () {
      {
        const { data, total } = await server.login.listSessions({ userId: user20.id })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        const session = data[0]
        expect(session.currentSession).to.be.false
      }

      {
        const { data, total } = await server.login.listSessions({ userId: user20.id, token: user20Token })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        const session = data[0]
        expect(session.currentSession).to.be.true
      }

      {
        const { data, total } = await server.login.listSessions({ userId: user10.id, token: user10Token2, sort: 'createdAt' })
        expect(total).to.equal(3)
        expect(data.length).to.equal(3)

        // Wait last activity scheduler
        await wait(2000)

        const session = data[0]
        expect(session.currentSession).to.be.false

        expect(new Date(session.lastActivityDate).getTime()).to.be.above(beforeAllDate)
        expect(new Date(session.createdAt).getTime()).to.be.above(beforeAllDate)
        expect(new Date(session.lastActivityDate).getTime()).to.equal(new Date(session.loginDate).getTime())

        expect(session.loginIP).to.equal('0.0.0.42')
        expect(session.lastActivityIP).to.equal(session.loginIP)

        expect(session.loginDevice).to.equal('web')
        expect(session.lastActivityDevice).to.equal(session.loginDevice)

        expect(data[1].currentSession).to.be.true
        expect(data[2].currentSession).to.be.false
      }

      {
        const { data, total } = await server.login.listSessions({
          userId: user10.id,
          token: user10Token,
          sort: '-createdAt',
          start: 0,
          count: 1
        })
        expect(total).to.equal(3)
        expect(data.length).to.equal(1)
        expect(data[0].currentSession).to.be.false
      }

      {
        const { data, total } = await server.login.listSessions({
          userId: user10.id,
          token: user10Token,
          sort: '-createdAt',
          start: 1,
          count: 2
        })
        expect(total).to.equal(3)
        expect(data.length).to.equal(2)
        expect(data[0].currentSession).to.be.false
        expect(data[1].currentSession).to.be.true
      }
    })

    it('Should refresh a token session and have appropriate metadata', async function () {
      const now = new Date()

      const { body } = await server.login.refreshToken({
        refreshToken: user20RefreshToken,
        userAgent: 'user agent 2',
        xForwardedFor: '0.0.0.1,127.0.0.1'
      })
      const newAccessToken = body.access_token

      {
        const { data, total } = await server.login.listSessions({ userId: user20.id, token: newAccessToken })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        const session = data[0]

        expect(session.currentSession).to.be.true

        expect(new Date(session.loginDate).getTime()).to.be.below(now.getTime())
        expect(new Date(session.lastActivityDate).getTime()).to.be.above(now.getTime())

        expect(session.loginDevice).to.not.equal(session.lastActivityDevice)
        expect(session.loginIP).to.not.equal(session.lastActivityIP)

        expect(session.lastActivityDevice).to.equal('user agent 2')
        expect(session.lastActivityIP).to.equal('0.0.0.1')
      }
    })

    it('Should update last activity of a session', async function () {
      const now = new Date()

      await server.users.getMyInfo({ token: user10Token, userAgent: 'web 2', xForwardedFor: '0.0.0.43,127.0.0.1' })
      await wait(3000)

      {
        const { data, total } = await server.login.listSessions({ userId: user10.id, token: user10Token, sort: 'createdAt' })
        expect(total).to.equal(3)
        expect(data.length).to.equal(3)

        const session = data[0]
        expect(session.currentSession).to.be.true

        expect(new Date(session.lastActivityDate).getTime()).to.be.above(now.getTime())
        expect(new Date(session.loginDate).getTime()).to.be.below(now.getTime())

        expect(session.loginIP).to.equal('0.0.0.42')
        expect(session.lastActivityIP).to.equal('0.0.0.43')

        expect(session.loginDevice).to.equal('web')
        expect(session.lastActivityDevice).to.equal('web 2')
      }
    })

    it('Should update last activity of a session even after a server restart', async function () {
      this.timeout(60000)

      await server.kill()
      await server.run()

      {
        const { data } = await server.login.listSessions({ userId: user10.id, token: user10Token, sort: 'createdAt' })
        const session = data[0]
        expect(session.currentSession).to.be.true

        expect(session.lastActivityIP).to.not.equal('0.0.0.42')
        expect(session.lastActivityDevice).to.not.equal('web')
      }
    })

    it('Should revoke a token session', async function () {
      const token4 = await server.login.getAccessToken({ username: 'user10', password: 'password' })
      await server.users.getMyInfo({ token: token4 })

      const { data } = await server.login.listSessions({ userId: user10.id, token: user10Token, sort: '-createdAt' })
      const tokenSession4 = data[0]

      await server.login.revokeSession({
        sessionId: tokenSession4.id,
        userId: user10.id,
        token: user10Token
      })

      await server.users.getMyInfo({ token: token4, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should revoke a token session of another user', async function () {
      const token5 = await server.login.getAccessToken({ username: 'user10', password: 'password' })
      await server.users.getMyInfo({ token: token5 })

      const { data } = await server.login.listSessions({ userId: user10.id, token: user10Token, sort: '-createdAt' })
      const tokenSession4 = data[0]

      await server.login.revokeSession({
        sessionId: tokenSession4.id,
        userId: user10.id
      })

      await server.users.getMyInfo({ token: token5, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
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
