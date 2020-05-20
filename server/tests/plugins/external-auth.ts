/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { ServerConfig, User, UserRole } from '@shared/models'
import {
  decodeQueryString,
  getConfig,
  getExternalAuth,
  getMyUserInformation,
  getPluginTestPath,
  installPlugin,
  loginUsingExternalToken,
  logout,
  refreshToken,
  setAccessTokensToServers,
  uninstallPlugin,
  updateMyUser,
  wait,
  userLogin,
  updatePluginSettings,
  createUser
} from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'

async function loginExternal (options: {
  server: ServerInfo
  npmName: string
  authName: string
  username: string
  query?: any
  statusCodeExpected?: number
  statusCodeExpectedStep2?: number
}) {
  const res = await getExternalAuth({
    url: options.server.url,
    npmName: options.npmName,
    npmVersion: '0.0.1',
    authName: options.authName,
    query: options.query,
    statusCodeExpected: options.statusCodeExpected || 302
  })

  if (res.status !== 302) return

  const location = res.header.location
  const { externalAuthToken } = decodeQueryString(location)

  const resLogin = await loginUsingExternalToken(
    options.server,
    options.username,
    externalAuthToken as string,
    options.statusCodeExpectedStep2
  )

  return resLogin.body
}

describe('Test external auth plugins', function () {
  let server: ServerInfo

  let cyanAccessToken: string
  let cyanRefreshToken: string

  let kefkaAccessToken: string
  let kefkaRefreshToken: string

  let externalAuthToken: string

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    for (const suffix of [ 'one', 'two' ]) {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        path: getPluginTestPath('-external-auth-' + suffix)
      })
    }
  })

  it('Should display the correct configuration', async function () {
    const res = await getConfig(server.url)

    const config: ServerConfig = res.body

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(6)

    const auth2 = auths.find((a) => a.authName === 'external-auth-2')
    expect(auth2).to.exist
    expect(auth2.authDisplayName).to.equal('External Auth 2')
    expect(auth2.npmName).to.equal('peertube-plugin-test-external-auth-one')
  })

  it('Should redirect for a Cyan login', async function () {
    const res = await getExternalAuth({
      url: server.url,
      npmName: 'test-external-auth-one',
      npmVersion: '0.0.1',
      authName: 'external-auth-1',
      query: {
        username: 'cyan'
      },
      statusCodeExpected: 302
    })

    const location = res.header.location
    expect(location.startsWith('/login?')).to.be.true

    const searchParams = decodeQueryString(location)

    expect(searchParams.externalAuthToken).to.exist
    expect(searchParams.username).to.equal('cyan')

    externalAuthToken = searchParams.externalAuthToken as string
  })

  it('Should reject auto external login with a missing or invalid token', async function () {
    await loginUsingExternalToken(server, 'cyan', '', 400)
    await loginUsingExternalToken(server, 'cyan', 'blabla', 400)
  })

  it('Should reject auto external login with a missing or invalid username', async function () {
    await loginUsingExternalToken(server, '', externalAuthToken, 400)
    await loginUsingExternalToken(server, '', externalAuthToken, 400)
  })

  it('Should reject auto external login with an expired token', async function () {
    this.timeout(15000)

    await wait(5000)

    await loginUsingExternalToken(server, 'cyan', externalAuthToken, 400)

    await waitUntilLog(server, 'expired external auth token')
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
      const res = await getMyUserInformation(server.url, cyanAccessToken)

      const body: User = res.body
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
      const res = await getMyUserInformation(server.url, kefkaAccessToken)

      const body: User = res.body
      expect(body.username).to.equal('kefka')
      expect(body.account.displayName).to.equal('Kefka Palazzo')
      expect(body.email).to.equal('kefka@example.com')
      expect(body.role).to.equal(UserRole.ADMINISTRATOR)
    }
  })

  it('Should refresh Cyan token, but not Kefka token', async function () {
    {
      const resRefresh = await refreshToken(server, cyanRefreshToken)
      cyanAccessToken = resRefresh.body.access_token
      cyanRefreshToken = resRefresh.body.refresh_token

      const res = await getMyUserInformation(server.url, cyanAccessToken)
      const user: User = res.body
      expect(user.username).to.equal('cyan')
    }

    {
      await refreshToken(server, kefkaRefreshToken, 400)
    }
  })

  it('Should update Cyan profile', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: cyanAccessToken,
      displayName: 'Cyan Garamonde',
      description: 'Retainer to the king of Doma'
    })

    const res = await getMyUserInformation(server.url, cyanAccessToken)

    const body: User = res.body
    expect(body.account.displayName).to.equal('Cyan Garamonde')
    expect(body.account.description).to.equal('Retainer to the king of Doma')
  })

  it('Should logout Cyan', async function () {
    await logout(server.url, cyanAccessToken)
  })

  it('Should have logged out Cyan', async function () {
    await waitUntilLog(server, 'On logout cyan')

    await getMyUserInformation(server.url, cyanAccessToken, 401)
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

    const res = await getMyUserInformation(server.url, cyanAccessToken)

    const body: User = res.body
    expect(body.username).to.equal('cyan')
    expect(body.account.displayName).to.equal('Cyan Garamonde')
    expect(body.account.description).to.equal('Retainer to the king of Doma')
    expect(body.role).to.equal(UserRole.USER)
  })

  it('Should not update an external auth email', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: cyanAccessToken,
      email: 'toto@example.com',
      currentPassword: 'toto',
      statusCodeExpected: 400
    })
  })

  it('Should reject token of Kefka by the plugin hook', async function () {
    this.timeout(10000)

    await wait(5000)

    await getMyUserInformation(server.url, kefkaAccessToken, 401)
  })

  it('Should unregister external-auth-2 and do not login existing Kefka', async function () {
    await updatePluginSettings({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-test-external-auth-one',
      settings: { disableKefka: true }
    })

    await userLogin(server, { username: 'kefka', password: 'fake' }, 400)

    await loginExternal({
      server,
      npmName: 'test-external-auth-one',
      authName: 'external-auth-2',
      query: {
        username: 'kefka'
      },
      username: 'kefka',
      statusCodeExpected: 404
    })
  })

  it('Should have disabled this auth', async function () {
    const res = await getConfig(server.url)

    const config: ServerConfig = res.body

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(5)

    const auth1 = auths.find(a => a.authName === 'external-auth-2')
    expect(auth1).to.not.exist
  })

  it('Should uninstall the plugin one and do not login Cyan', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-test-external-auth-one'
    })

    await loginExternal({
      server,
      npmName: 'test-external-auth-one',
      authName: 'external-auth-1',
      query: {
        username: 'cyan'
      },
      username: 'cyan',
      statusCodeExpected: 404
    })

    await userLogin(server, { username: 'cyan', password: null }, 400)
    await userLogin(server, { username: 'cyan', password: '' }, 400)
    await userLogin(server, { username: 'cyan', password: 'fake' }, 400)
  })

  it('Should not login kefka with another plugin', async function () {
    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-4',
      username: 'kefka2',
      statusCodeExpectedStep2: 400
    })

    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-4',
      username: 'kefka',
      statusCodeExpectedStep2: 400
    })
  })

  it('Should not login an existing user', async function () {
    await createUser({
      url: server.url,
      accessToken: server.accessToken,
      username: 'existing_user',
      password: 'super_password'
    })

    await loginExternal({
      server,
      npmName: 'test-external-auth-two',
      authName: 'external-auth-6',
      username: 'existing_user',
      statusCodeExpectedStep2: 400
    })
  })

  it('Should display the correct configuration', async function () {
    const res = await getConfig(server.url)

    const config: ServerConfig = res.body

    const auths = config.plugin.registeredExternalAuths
    expect(auths).to.have.lengthOf(4)

    const auth2 = auths.find((a) => a.authName === 'external-auth-2')
    expect(auth2).to.not.exist
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
