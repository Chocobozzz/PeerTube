/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ServerErrorCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { loginExternal } from '@tests/shared/plugins.js'
import { expect } from 'chai'

describe('Test password confirmation of sensitive actions', function () {
  let server: PeerTubeServer
  let kefkaToken: string
  let moderatorId: number

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1, {
      rates_limit: {
        password_confirmation: {
          window: '5 seconds',
          max: 3
        }
      }
    })
    await setAccessTokensToServers([ server ])
  })

  describe('With password confirmation enabled', function () {
    it('Should expose password confirmation in the server config', async function () {
      const config = await server.config.getConfig()

      expect(config.security.passwordConfirmation.enabled).to.be.true
    })

    it('Should require the password to install or update a plugin', async function () {
      this.timeout(60000)

      const path = PluginsCommand.getPluginTestPath()

      {
        const res = await server.plugins.install({ path, currentPassword: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        expect(res.body.code).to.equal(ServerErrorCode.CURRENT_PASSWORD_IS_MISSING)
      }

      {
        const res = await server.plugins.install({ path, currentPassword: 'bad password', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        expect(res.body.code).to.equal(ServerErrorCode.CURRENT_PASSWORD_IS_INVALID)
      }

      await server.plugins.install({ path })

      await server.plugins.update({ path, currentPassword: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.plugins.update({ path, currentPassword: 'bad password', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await server.plugins.update({ path })
    })

    it('Should require the password to change the custom JavaScript or CSS only', async function () {
      await server.config.updateExistingConfig({ newConfig: { instance: { name: 'new name' } }, currentPassword: null })

      for (const customizations of [ { javascript: 'alert("coucou")' }, { css: 'body { color: red; }' } ]) {
        await server.config.updateExistingConfig({
          newConfig: { instance: { customizations } },
          currentPassword: null,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })

        await server.config.updateExistingConfig({
          newConfig: { instance: { customizations } },
          currentPassword: 'bad password',
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })

        await server.config.updateExistingConfig({ newConfig: { instance: { customizations } } })

        // Unchanged
        await server.config.updateExistingConfig({ newConfig: { instance: { customizations } }, currentPassword: null })
      }
    })

    it('Should not save the current password in the custom config', async function () {
      const config = await server.config.getCustomConfig()

      expect(config.instance.customizations.javascript).to.equal('alert("coucou")')
      expect(config.instance.customizations.css).to.equal('body { color: red; }')
      expect((config as any).currentPassword).to.not.exist
    })

    it('Should require the password to create an administrator', async function () {
      await server.users.create({ username: 'moderator', role: UserRole.MODERATOR, currentPassword: null })

      await server.users.create({
        username: 'other_admin1',
        role: UserRole.ADMINISTRATOR,
        currentPassword: null,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.users.create({
        username: 'other_admin1',
        role: UserRole.ADMINISTRATOR,
        currentPassword: 'bad password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await server.users.create({ username: 'other_admin1', role: UserRole.ADMINISTRATOR })
    })

    it('Should refuse a too long password confirmation', async function () {
      const res = await server.plugins.install({
        path: PluginsCommand.getPluginTestPath(),
        currentPassword: 'super'.repeat(61),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      expect(res.body.code).to.equal(ServerErrorCode.TOO_LONG_PASSWORD)
    })

    it('Should require the password to give the administrator role', async function () {
      const { userId } = await server.users.generate('moderator2', UserRole.MODERATOR)

      await server.users.update({ userId, videoQuota: 42, currentPassword: null })

      await server.users.update({
        userId,
        role: UserRole.ADMINISTRATOR,
        currentPassword: null,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.users.update({
        userId,
        role: UserRole.ADMINISTRATOR,
        currentPassword: 'bad password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await server.users.update({ userId, role: UserRole.ADMINISTRATOR })

      // Already an administrator
      await server.users.update({ userId, role: UserRole.ADMINISTRATOR, videoQuota: 43, currentPassword: null })
    })

    it('Should require the password to change the credentials of an administrator', async function () {
      const { id: adminId } = await server.users.create({ username: 'admin_credentials', role: UserRole.ADMINISTRATOR })
      const { userId } = await server.users.generate('user_credentials')

      // Not an administrator
      await server.users.update({ userId, password: 'new password', email: 'new_user@example.com', currentPassword: null })

      for (const toUpdate of [ { password: 'new password' }, { email: 'new_admin@example.com' }, { pluginAuth: 'peertube-plugin-toto' } ]) {
        await server.users.update({ userId: adminId, ...toUpdate, currentPassword: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }

      // Unchanged email
      await server.users.update({ userId: adminId, email: 'admin_credentials@example.com', videoQuota: 42, currentPassword: null })

      await server.users.update({ userId: adminId, password: 'new password' })
      await server.users.update({ userId: adminId, email: 'new_admin@example.com' })
    })

    it('Should limit failed password confirmations', async function () {
      this.timeout(60000)

      for (let i = 0; i < 3; i++) {
        await server.users.create({
          username: 'other_admin2',
          role: UserRole.ADMINISTRATOR,
          currentPassword: 'bad password',
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }

      // Even with the correct password
      await server.users.create({
        username: 'other_admin2',
        role: UserRole.ADMINISTRATOR,
        expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
      })

      // Failures are counted per user
      const otherAdminToken = await server.login.getAccessToken({ username: 'other_admin1', password: 'password' })
      await server.users.create({
        username: 'other_admin3',
        role: UserRole.ADMINISTRATOR,
        token: otherAdminToken,
        currentPassword: 'password'
      })

      await wait(6000)

      await server.users.create({ username: 'other_admin2', role: UserRole.ADMINISTRATOR })
    })

    it('Should limit concurrent failed password confirmations', async function () {
      this.timeout(60000)

      const path = PluginsCommand.getPluginTestPath()

      const results = await Promise.all(
        Array.from({ length: 10 }, () => server.plugins.install({ path, currentPassword: 'bad password', expectedStatus: null }))
      )
      const statuses = results.map(r => r.status)

      expect(statuses.filter(s => s === HttpStatusCode.FORBIDDEN_403)).to.have.lengthOf(3)
      expect(statuses.filter(s => s === HttpStatusCode.TOO_MANY_REQUESTS_429)).to.have.lengthOf(7)

      await wait(6000)
    })

    it('Should confirm the password of an administrator using an id and pass auth plugin', async function () {
      this.timeout(60000)

      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-id-pass-auth-one') })

      const spyro = { username: 'spyro', password: 'spyro password' }

      const { id } = await server.users.getMyInfo({ token: await server.login.getAccessToken(spyro) })
      await server.users.update({ userId: id, role: UserRole.ADMINISTRATOR })

      const spyroToken = await server.login.getAccessToken(spyro)

      await server.users.create({
        username: 'other_admin4',
        role: UserRole.ADMINISTRATOR,
        token: spyroToken,
        currentPassword: 'bad password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await server.users.create({
        username: 'other_admin4',
        role: UserRole.ADMINISTRATOR,
        token: spyroToken,
        currentPassword: spyro.password
      })
    })

    it('Should refuse sensitive actions of an administrator using an external auth plugin', async function () {
      this.timeout(60000)

      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-external-auth-one') })

      const res = await loginExternal({ server, npmName: 'test-external-auth-one', authName: 'external-auth-2', username: 'kefka' })
      kefkaToken = res.access_token

      const { role } = await server.users.getMyInfo({ token: kefkaToken })
      expect(role.id).to.equal(UserRole.ADMINISTRATOR)

      {
        const res = await server.plugins.install({
          path: PluginsCommand.getPluginTestPath('-two'),
          token: kefkaToken,
          currentPassword: 'kefka password',
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })

        expect(res.body.code).to.equal(ServerErrorCode.PASSWORD_CONFIRMATION_UNAVAILABLE)
      }

      const { userId } = await server.users.generate('moderator3', UserRole.MODERATOR)
      moderatorId = userId

      await server.users.update({
        userId: moderatorId,
        role: UserRole.ADMINISTRATOR,
        token: kefkaToken,
        currentPassword: null,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('With password confirmation disabled', function () {
    before(async function () {
      this.timeout(60000)

      await server.kill()
      await server.run({
        security: {
          password_confirmation: {
            enabled: false
          }
        }
      })
    })

    it('Should expose password confirmation in the server config', async function () {
      const config = await server.config.getConfig()

      expect(config.security.passwordConfirmation.enabled).to.be.false
    })

    it('Should run sensitive actions without the password', async function () {
      this.timeout(60000)

      await server.plugins.update({ path: PluginsCommand.getPluginTestPath(), currentPassword: null })
      await server.config.updateExistingConfig({ newConfig: { instance: { customizations: { javascript: '' } } }, currentPassword: null })
      await server.users.create({ username: 'other_admin5', role: UserRole.ADMINISTRATOR, currentPassword: null })
    })

    it('Should run sensitive actions as an administrator using an external auth plugin', async function () {
      this.timeout(60000)

      // external-auth-2 access tokens are only valid 5 seconds
      const res = await loginExternal({ server, npmName: 'test-external-auth-one', authName: 'external-auth-2', username: 'kefka' })
      kefkaToken = res.access_token

      await server.users.update({ userId: moderatorId, role: UserRole.ADMINISTRATOR, token: kefkaToken, currentPassword: null })
      await server.users.create({ username: 'other_admin6', role: UserRole.ADMINISTRATOR, token: kefkaToken, currentPassword: null })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
