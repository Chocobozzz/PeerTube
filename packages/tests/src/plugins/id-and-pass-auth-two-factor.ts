/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, ServerErrorCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  TwoFactorCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { runTwoFactorTests, TwoFactorTestUser } from '@tests/shared/two-factor.js'
import { expect } from 'chai'

describe('Test two factor authentication with id and pass auth plugins', function () {
  let server: PeerTubeServer

  const crash = {} as TwoFactorTestUser
  let crashOTPSecret: string

  let lagunaId: number

  const emails: object[] = []

  // Sync with rates_limit.login_lockout of test.yaml
  const maxFailures = 10
  const maxFailuresPerIP = 3
  const lifetimeMs = 5000

  function crashOTP () {
    return TwoFactorCommand.buildOTP({ secret: crashOTPSecret }).generate()
  }

  async function failCrashOTPLogins (count: number) {
    for (let i = 0; i < count; i++) {
      const xForwardedFor = `0.0.0.${Math.floor(i / maxFailuresPerIP) + 1},127.0.0.1`

      await server.login.login({
        user: { username: 'crash', password: 'crash password' },
        otpToken: '123456',
        xForwardedFor,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    }
  }

  before(async function () {
    this.timeout(30000)

    const emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          max: 100
        }
      },
      ...ConfigCommand.getEmailOverrideConfig(emailPort)
    })

    await setAccessTokensToServers([ server ])

    for (const suffix of [ 'one', 'two' ]) {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-id-pass-auth-' + suffix) })
    }

    {
      const token = await server.login.getAccessToken({ username: 'crash', password: 'crash password' })
      const { id } = await server.users.getMyInfo({ token })

      Object.assign(crash, { server, userId: id, token, username: 'crash', password: 'crash password' })
    }

    {
      const token = await server.login.getAccessToken({ username: 'laguna', password: 'laguna password' })
      lagunaId = (await server.users.getMyInfo({ token })).id
    }
  })

  describe('Common two factor tests', function () {
    runTwoFactorTests(crash)
  })

  describe('Login lockout', function () {
    before(async function () {
      const { secret } = await server.twoFactor.requestAndConfirm({ userId: crash.userId })
      crashOTPSecret = secret
    })

    it('Should lock the account after too many OTP failures', async function () {
      this.timeout(30000)

      await failCrashOTPLogins(maxFailures)

      const { body } = await server.login.loginAndGetResponse({
        user: { username: 'crash', password: 'crash password' },
        otpToken: crashOTP(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
      expect((body as unknown as PeerTubeProblemDocument).code).to.equal(ServerErrorCode.INVALID_GRANT)

      await failCrashOTPLogins(maxFailuresPerIP * 2)

      await waitJobs(server)

      const lockedEmails = emails.filter(e => e['subject'].includes('temporarily locked'))
      expect(lockedEmails).to.have.lengthOf(1)
      expect(lockedEmails[0]['to'][0]['address']).to.equal('crash@example.com')
    })

    it('Should unlock the account after the lockout window', async function () {
      this.timeout(30000)

      await wait(lifetimeMs + 1000)

      await server.login.login({ user: { username: 'crash', password: 'crash password' }, otpToken: crashOTP() })
    })

    after(async function () {
      await server.twoFactor.disable({ userId: crash.userId })
    })
  })

  describe('Plugin user updates', function () {
    it('Should not apply plugin changes to the account on an OTP failure', async function () {
      const { secret } = await server.twoFactor.requestAndConfirm({ userId: lagunaId })

      await server.users.update({ userId: lagunaId, videoQuota: 44000 })

      await server.login.login({
        user: { username: 'laguna', password: 'laguna password' },
        otpToken: '123456',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      {
        const user = await server.users.get({ userId: lagunaId })
        expect(user.videoQuota).to.equal(44000)
      }

      await server.login.login({
        user: { username: 'laguna', password: 'laguna password' },
        otpToken: TwoFactorCommand.buildOTP({ secret }).generate()
      })

      {
        // The plugin userUpdater overrides the video quota on login
        const user = await server.users.get({ userId: lagunaId })
        expect(user.videoQuota).to.equal(42000)
      }

      await server.twoFactor.disable({ userId: lagunaId })
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
