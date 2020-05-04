/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'
import {
  getMyUserInformation,
  getPluginTestPath,
  installPlugin,
  logout,
  setAccessTokensToServers,
  uninstallPlugin,
  updateMyUser,
  userLogin,
  wait,
  login, refreshToken
} from '../../../shared/extra-utils'
import { User, UserRole } from '@shared/models'
import { expect } from 'chai'

describe('Test id and pass auth plugins', function () {
  let server: ServerInfo

  let crashAccessToken: string
  let crashRefreshToken: string

  let lagunaAccessToken: string
  let lagunaRefreshToken: string

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    for (const suffix of [ 'one', 'two', 'three' ]) {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        path: getPluginTestPath('-id-pass-auth-' + suffix)
      })
    }
  })

  it('Should not login', async function () {
    await userLogin(server, { username: 'toto', password: 'password' }, 400)
  })

  it('Should login Spyro, create the user and use the token', async function () {
    const accessToken = await userLogin(server, { username: 'spyro', password: 'spyro password' })

    const res = await getMyUserInformation(server.url, accessToken)

    const body: User = res.body
    expect(body.username).to.equal('spyro')
    expect(body.account.displayName).to.equal('Spyro the Dragon')
    expect(body.role).to.equal(UserRole.USER)
  })

  it('Should login Crash, create the user and use the token', async function () {
    {
      const res = await login(server.url, server.client, { username: 'crash', password: 'crash password' })
      crashAccessToken = res.body.access_token
      crashRefreshToken = res.body.refresh_token
    }

    {
      const res = await getMyUserInformation(server.url, crashAccessToken)

      const body: User = res.body
      expect(body.username).to.equal('crash')
      expect(body.account.displayName).to.equal('Crash Bandicoot')
      expect(body.role).to.equal(UserRole.MODERATOR)
    }
  })

  it('Should login the first Laguna, create the user and use the token', async function () {
    {
      const res = await login(server.url, server.client, { username: 'laguna', password: 'laguna password' })
      lagunaAccessToken = res.body.access_token
      lagunaRefreshToken = res.body.refresh_token
    }

    {
      const res = await getMyUserInformation(server.url, lagunaAccessToken)

      const body: User = res.body
      expect(body.username).to.equal('laguna')
      expect(body.account.displayName).to.equal('laguna')
      expect(body.role).to.equal(UserRole.USER)
    }
  })

  it('Should refresh crash token, but not laguna token', async function () {
    {
      const resRefresh = await refreshToken(server, crashRefreshToken)
      crashAccessToken = resRefresh.body.access_token
      crashRefreshToken = resRefresh.body.refresh_token

      const res = await getMyUserInformation(server.url, crashAccessToken)
      const user: User = res.body
      expect(user.username).to.equal('crash')
    }

    {
      await refreshToken(server, lagunaRefreshToken, 400)
    }
  })

  it('Should update Crash profile', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: crashAccessToken,
      displayName: 'Beautiful Crash',
      description: 'Mutant eastern barred bandicoot'
    })

    const res = await getMyUserInformation(server.url, crashAccessToken)

    const body: User = res.body
    expect(body.account.displayName).to.equal('Beautiful Crash')
    expect(body.account.description).to.equal('Mutant eastern barred bandicoot')
  })

  it('Should logout Crash', async function () {
    await logout(server.url, crashAccessToken)
  })

  it('Should have logged out Crash', async function () {
    await waitUntilLog(server, 'On logout for auth 1 - 2')

    await getMyUserInformation(server.url, crashAccessToken, 401)
  })

  it('Should login Crash and keep the old existing profile', async function () {
    crashAccessToken = await userLogin(server, { username: 'crash', password: 'crash password' })

    const res = await getMyUserInformation(server.url, crashAccessToken)

    const body: User = res.body
    expect(body.username).to.equal('crash')
    expect(body.account.displayName).to.equal('Beautiful Crash')
    expect(body.account.description).to.equal('Mutant eastern barred bandicoot')
    expect(body.role).to.equal(UserRole.MODERATOR)
  })

  it('Should correctly auth token of laguna', async function () {
    this.timeout(10000)

    await wait(5000)

    await getMyUserInformation(server.url, lagunaAccessToken, 401)
  })

  it('Should uninstall the plugin one and do not login existing Crash', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-test-id-pass-auth-one'
    })

    await userLogin(server, { username: 'crash', password: 'crash password' }, 400)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
