/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test id and pass auth plugins', function () {
  let server: PeerTubeServer

  let crashAccessToken: string
  let crashRefreshToken: string

  let lagunaAccessToken: string
  let lagunaRefreshToken: string
  let lagunaId: number

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    for (const suffix of [ 'one', 'two', 'three' ]) {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-id-pass-auth-' + suffix) })
    }
  })

  it('Should display the correct configuration', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredIdAndPassAuths
    expect(auths).to.have.lengthOf(8)

    const crashAuth = auths.find(a => a.authName === 'crash-auth')
    expect(crashAuth).to.exist
    expect(crashAuth.npmName).to.equal('peertube-plugin-test-id-pass-auth-one')
    expect(crashAuth.weight).to.equal(50)
  })

  it('Should not login', async function () {
    await server.login.login({ user: { username: 'toto', password: 'password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should login Spyro, create the user and use the token', async function () {
    const accessToken = await server.login.getAccessToken({ username: 'spyro', password: 'spyro password' })

    const body = await server.users.getMyInfo({ token: accessToken })

    expect(body.username).to.equal('spyro')
    expect(body.account.displayName).to.equal('Spyro the Dragon')
    expect(body.role.id).to.equal(UserRole.USER)
  })

  it('Should login Crash, create the user and use the token', async function () {
    {
      const body = await server.login.login({ user: { username: 'crash', password: 'crash password' } })
      crashAccessToken = body.access_token
      crashRefreshToken = body.refresh_token
    }

    {
      const body = await server.users.getMyInfo({ token: crashAccessToken })

      expect(body.username).to.equal('crash')
      expect(body.account.displayName).to.equal('Crash Bandicoot')
      expect(body.role.id).to.equal(UserRole.MODERATOR)
    }
  })

  it('Should login the first Laguna, create the user and use the token', async function () {
    {
      const body = await server.login.login({ user: { username: 'laguna', password: 'laguna password' } })
      lagunaAccessToken = body.access_token
      lagunaRefreshToken = body.refresh_token
    }

    {
      const body = await server.users.getMyInfo({ token: lagunaAccessToken })

      expect(body.username).to.equal('laguna')
      expect(body.account.displayName).to.equal('Laguna Loire')
      expect(body.role.id).to.equal(UserRole.USER)

      lagunaId = body.id
    }
  })

  it('Should refresh crash token, but not laguna token', async function () {
    {
      const resRefresh = await server.login.refreshToken({ refreshToken: crashRefreshToken })
      crashAccessToken = resRefresh.body.access_token
      crashRefreshToken = resRefresh.body.refresh_token

      const body = await server.users.getMyInfo({ token: crashAccessToken })
      expect(body.username).to.equal('crash')
    }

    {
      await server.login.refreshToken({ refreshToken: lagunaRefreshToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    }
  })

  it('Should update Crash profile', async function () {
    await server.users.updateMe({
      token: crashAccessToken,
      displayName: 'Beautiful Crash',
      description: 'Mutant eastern barred bandicoot'
    })

    const body = await server.users.getMyInfo({ token: crashAccessToken })

    expect(body.account.displayName).to.equal('Beautiful Crash')
    expect(body.account.description).to.equal('Mutant eastern barred bandicoot')
  })

  it('Should logout Crash', async function () {
    await server.login.logout({ token: crashAccessToken })
  })

  it('Should have logged out Crash', async function () {
    await server.servers.waitUntilLog('On logout for auth 1 - 2')

    await server.users.getMyInfo({ token: crashAccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should login Crash and keep the old existing profile', async function () {
    crashAccessToken = await server.login.getAccessToken({ username: 'crash', password: 'crash password' })

    const body = await server.users.getMyInfo({ token: crashAccessToken })

    expect(body.username).to.equal('crash')
    expect(body.account.displayName).to.equal('Beautiful Crash')
    expect(body.account.description).to.equal('Mutant eastern barred bandicoot')
    expect(body.role.id).to.equal(UserRole.MODERATOR)
  })

  it('Should login Laguna and update the profile', async function () {
    {
      await server.users.update({ userId: lagunaId, videoQuota: 43000, videoQuotaDaily: 43100 })
      await server.users.updateMe({ token: lagunaAccessToken, displayName: 'laguna updated' })

      const body = await server.users.getMyInfo({ token: lagunaAccessToken })
      expect(body.username).to.equal('laguna')
      expect(body.account.displayName).to.equal('laguna updated')
      expect(body.videoQuota).to.equal(43000)
      expect(body.videoQuotaDaily).to.equal(43100)
    }

    {
      const body = await server.login.login({ user: { username: 'laguna', password: 'laguna password' } })
      lagunaAccessToken = body.access_token
      lagunaRefreshToken = body.refresh_token
    }

    {
      const body = await server.users.getMyInfo({ token: lagunaAccessToken })
      expect(body.username).to.equal('laguna')
      expect(body.account.displayName).to.equal('Laguna Loire')
      expect(body.videoQuota).to.equal(42000)
      expect(body.videoQuotaDaily).to.equal(43100)
    }
  })

  it('Should reject token of laguna by the plugin hook', async function () {
    await wait(5000)

    await server.users.getMyInfo({ token: lagunaAccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should reject an invalid username, email, role or display name', async function () {
    const command = server.login

    await command.login({ user: { username: 'ward', password: 'ward password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.servers.waitUntilLog('valid username')

    await command.login({ user: { username: 'kiros', password: 'kiros password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.servers.waitUntilLog('valid displayName')

    await command.login({ user: { username: 'raine', password: 'raine password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.servers.waitUntilLog('valid role')

    await command.login({ user: { username: 'ellone', password: 'elonne password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.servers.waitUntilLog('valid email')
  })

  it('Should unregister spyro-auth and do not login existing Spyro', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-test-id-pass-auth-one',
      settings: { disableSpyro: true }
    })

    const command = server.login
    await command.login({ user: { username: 'spyro', password: 'spyro password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await command.login({ user: { username: 'spyro', password: 'fake' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should have disabled this auth', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredIdAndPassAuths
    expect(auths).to.have.lengthOf(7)

    const spyroAuth = auths.find(a => a.authName === 'spyro-auth')
    expect(spyroAuth).to.not.exist
  })

  it('Should uninstall the plugin one and do not login existing Crash', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-id-pass-auth-one' })

    await server.login.login({
      user: { username: 'crash', password: 'crash password' },
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should display the correct configuration', async function () {
    const config = await server.config.getConfig()

    const auths = config.plugin.registeredIdAndPassAuths
    expect(auths).to.have.lengthOf(6)

    const crashAuth = auths.find(a => a.authName === 'crash-auth')
    expect(crashAuth).to.not.exist
  })

  it('Should display plugin auth information in users list', async function () {
    const { data } = await server.users.list()

    const root = data.find(u => u.username === 'root')
    const crash = data.find(u => u.username === 'crash')
    const laguna = data.find(u => u.username === 'laguna')

    expect(root.pluginAuth).to.be.null
    expect(crash.pluginAuth).to.equal('peertube-plugin-test-id-pass-auth-one')
    expect(laguna.pluginAuth).to.equal('peertube-plugin-test-id-pass-auth-two')
  })

  it('Should not update a user if not owned by the plugin auth', async function () {
    {
      await server.users.update({ userId: lagunaId, videoQuota: 43000, password: 'coucou', pluginAuth: null })

      const body = await server.users.get({ userId: lagunaId })
      expect(body.videoQuota).to.equal(43000)
      expect(body.pluginAuth).to.be.null
    }

    {
      await server.login.login({
        user: { username: 'laguna', password: 'laguna password' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    }

    {
      const body = await server.users.get({ userId: lagunaId })
      expect(body.videoQuota).to.equal(43000)
      expect(body.pluginAuth).to.be.null
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
