/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  decodeQueryString,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  wait
} from '@shared/extra-utils'
import { HttpStatusCode, UserRole } from '@shared/models'

async function loginExternal (options: {
  server: PeerTubeServer
  npmName: string
  authName: string
  username: string
  query?: any
  expectedStatus?: HttpStatusCode
  expectedStatusStep2?: HttpStatusCode
}) {
  const res = await options.server.plugins.getExternalAuth({
    npmName: options.npmName,
    npmVersion: '0.0.1',
    authName: options.authName,
    query: options.query,
    expectedStatus: options.expectedStatus || HttpStatusCode.FOUND_302
  })

  if (res.status !== HttpStatusCode.FOUND_302) return

  const location = res.header.location
  const { externalAuthToken } = decodeQueryString(location)

  const resLogin = await options.server.login.loginUsingExternalToken({
    username: options.username,
    externalAuthToken: externalAuthToken as string,
    expectedStatus: options.expectedStatusStep2
  })

  return resLogin.body
}

describe('Test external auth plugins', function () {
  let server: PeerTubeServer

  let cyanAccessToken: string
  let cyanRefreshToken: string

  let kefkaAccessToken: string
  let kefkaRefreshToken: string

  let externalAuthToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    for (const suffix of [ 'one', 'two', 'three' ]) {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-external-auth-' + suffix) })
    }
  })

  it('Should display the correct configuration', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(8)

    const auth2 = auths.find((a) => a.authName === 'external-auth-2')
    expect(auth2).to.exist
    expect(auth2.authDisplayName).to.equal('External Auth 2')
    expect(auth2.npmName).to.equal('peertube-plugin-test-external-auth-one')
  })

  it('Should redirect for a Cyan login', async function () {
    const res = await server.plugins.getExternalAuth({
      npmName: 'test-external-auth-one',
      npmVersion: '0.0.1',
      authName: 'external-auth-1',
      query: {
        username: 'cyan'
      },
      expectedStatus: HttpStatusCode.FOUND_302
    })

    const location = res.header.location
    expect(location.startsWith('/login?')).to.be.true

    const searchParams = decodeQueryString(location)

    expect(searchParams.externalAuthToken).to.exist
    expect(searchParams.username).to.equal('cyan')

    externalAuthToken = searchParams.externalAuthToken as string
  })

  it('Should reject auto external login with a missing or invalid token', async function () {
    const command = server.login

    await command.loginUsingExternalToken({ username: 'cyan', externalAuthToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.loginUsingExternalToken({ username: 'cyan', externalAuthToken: 'blabla', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should reject auto external login with a missing or invalid username', async function () {
    const command = server.login

    await command.loginUsingExternalToken({ username: '', externalAuthToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.loginUsingExternalToken({ username: '', externalAuthToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should reject auto external login with an expired token', async function () {
    this.timeout(15000)

    await wait(5000)

    await server.login.loginUsingExternalToken({
      username: 'cyan',
      externalAuthToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    await server.servers.waitUntilLog('expired external auth token', 2)
  })

  it('Should auto login Cyan, create the user and use the token', async function () {
    {
      const res = await loginExternal({
        server,
        npmName: 'test-external-auth-one',
        authName: 'external-auth-1',
        query: {
          username: 'cyan'
        },
        username: 'cyan'
      })

      cyanAccessToken = res.access_token
      cyanRefreshToken = res.refresh_token
    }

    {
      const body = await server.users.getMyInfo({ token: cyanAccessToken })
      expect(body.username).to.equal('cyan')
      expect(body.account.displayName).to.equal('cyan')
      expect(body.email).to.equal('cyan@example.com')
      expect(body.role).to.equal(UserRole.USER)
    }
  })

  it('Should auto login Kefka, create the user and use the token', async function () {
    {
      const res = await loginExternal({
        server,
        npmName: 'test-external-auth-one',
        authName: 'external-auth-2',
        username: 'kefka'
      })

      kefkaAccessToken = res.access_token
      kefkaRefreshToken = res.refresh_token
    }

    {
      const body = await server.users.getMyInfo({ token: kefkaAccessToken })
      expect(body.username).to.equal('kefka')
      expect(body.account.displayName).to.equal('Kefka Palazzo')
      expect(body.email).to.equal('kefka@example.com')
      expect(body.role).to.equal(UserRole.ADMINISTRATOR)
    }
  })

  it('Should refresh Cyan token, but not Kefka token', async function () {
    {
      const resRefresh = await server.login.refreshToken({ refreshToken: cyanRefreshToken })
      cyanAccessToken = resRefresh.body.access_token
      cyanRefreshToken = resRefresh.body.refresh_token

      const body = await server.users.getMyInfo({ token: cyanAccessToken })
      expect(body.username).to.equal('cyan')
    }

    {
      await server.login.refreshToken({ refreshToken: kefkaRefreshToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    }
  })

  it('Should update Cyan profile', async function () {
    await server.users.updateMe({
      token: cyanAccessToken,
      displayName: 'Cyan Garamonde',
      description: 'Retainer to the king of Doma'
    })

    const body = await server.users.getMyInfo({ token: cyanAccessToken })
    expect(body.account.displayName).to.equal('Cyan Garamonde')
    expect(body.account.description).to.equal('Retainer to the king of Doma')
  })

  it('Should logout Cyan', async function () {
    await server.login.logout({ token: cyanAccessToken })
  })

  it('Should have logged out Cyan', async function () {
    await server.servers.waitUntilLog('On logout cyan')

    await server.users.getMyInfo({ token: cyanAccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should login Cyan and keep the old existing profile', async function () {
    {
      const res = await loginExternal({
        server,
        npmName: 'test-external-auth-one',
        authName: 'external-auth-1',
        query: {
          username: 'cyan'
        },
        username: 'cyan'
      })

      cyanAccessToken = res.access_token
    }

    const body = await server.users.getMyInfo({ token: cyanAccessToken })
    expect(body.username).to.equal('cyan')
    expect(body.account.displayName).to.equal('Cyan Garamonde')
    expect(body.account.description).to.equal('Retainer to the king of Doma')
    expect(body.role).to.equal(UserRole.USER)
  })

  it('Should not update an external auth email', async function () {
    await server.users.updateMe({
      token: cyanAccessToken,
      email: 'toto@example.com',
      currentPassword: 'toto',
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should reject token of Kefka by the plugin hook', async function () {
    this.timeout(10000)

    await wait(5000)

    await server.users.getMyInfo({ token: kefkaAccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should unregister external-auth-2 and do not login existing Kefka', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-test-external-auth-one',
      settings: { disableKefka: true }
    })

    await server.login.login({ user: { username: 'kefka', password: 'fake' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    await loginExternal({
      server,
      npmName: 'test-external-auth-one',
      authName: 'external-auth-2',
      query: {
        username: 'kefka'
      },
      username: 'kefka',
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })
  })

  it('Should have disabled this auth', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(7)

    const auth1 = auths.find(a => a.authName === 'external-auth-2')
    expect(auth1).to.not.exist
  })

  it('Should uninstall the plugin one and do not login Cyan', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-external-auth-one' })

    await loginExternal({
      server,
      npmName: 'test-external-auth-one',
      authName: 'external-auth-1',
      query: {
        username: 'cyan'
      },
      username: 'cyan',
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })

    await server.login.login({ user: { username: 'cyan', password: null }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.login.login({ user: { username: 'cyan', password: '' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.login.login({ user: { username: 'cyan', password: 'fake' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not login kefka with another plugin', async function () {
    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-4',
      username: 'kefka2',
      expectedStatusStep2: HttpStatusCode.BAD_REQUEST_400
    })

    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-4',
      username: 'kefka',
      expectedStatusStep2: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should not login an existing user', async function () {
    await server.users.create({ username: 'existing_user', password: 'super_password' })

    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-6',
      username: 'existing_user',
      expectedStatusStep2: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should display the correct configuration', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(6)

    const auth2 = auths.find((a) => a.authName === 'external-auth-2')
    expect(auth2).to.not.exist
  })

  after(async function () {
    await cleanupTests([ server ])
  })

  it('Should forward the redirectUrl if the plugin returns one', async function () {
    const resLogin = await loginExternal({
      server,
      npmName: 'test-external-auth-three',
      authName: 'external-auth-7',
      username: 'cid'
    })

    const { redirectUrl } = await server.login.logout({ token: resLogin.access_token })
    expect(redirectUrl).to.equal('https://example.com/redirectUrl')
  })

  it('Should call the plugin\'s onLogout method with the request', async function () {
    const resLogin = await loginExternal({
      server,
      npmName: 'test-external-auth-three',
      authName: 'external-auth-8',
      username: 'cid'
    })

    const { redirectUrl } = await server.login.logout({ token: resLogin.access_token })
    expect(redirectUrl).to.equal('https://example.com/redirectUrl?access_token=' + resLogin.access_token)
  })
})
