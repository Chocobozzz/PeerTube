/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, ServerErrorCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  TwoFactorCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { expect } from 'chai'

describe('Test login lockout', function () {
  let server: PeerTubeServer

  const userUsername = 'user1'
  const userEmail = userUsername + '@example.com'
  let userId: number
  let userPassword: string
  let userToken: string

  const emails: object[] = []

  // Sync with rates_limit.login_lockout in config/test.yaml (window is 5 seconds on a test instance)
  const maxFailures = 10
  const maxFailuresPerIP = 3
  const lifetimeMs = 5000

  function expectLockout (body: PeerTubeProblemDocument) {
    expect(body.code).to.equal(ServerErrorCode.TOO_MANY_LOGIN_FAILURES)
  }

  function expectLockedAccountEmailsCount (count: number) {
    expect(emails).to.have.lengthOf(count)
    if (count === 0) return

    const email = emails[count - 1]
    expect(email['to'][0]['address']).to.equal(userEmail)
    expect(email['subject']).to.contain('temporarily locked')
    expect(email['text']).to.contain(userUsername)
  }

  // A single IP's failures only count towards the account lock up to maxFailuresPerIP, so spread
  // failures across a new fake IP every maxFailuresPerIP calls to actually reach the account threshold
  function xForwardedForAt (index: number) {
    const ipIndex = Math.floor(index / maxFailuresPerIP) + 1

    return `0.0.0.${ipIndex},127.0.0.1`
  }

  async function failLogin (password: string, otpToken?: string, xForwardedFor?: string) {
    const { body } = await server.login.loginAndGetResponse({
      user: { username: userUsername, password },
      otpToken,
      xForwardedFor,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    return body as unknown as PeerTubeProblemDocument
  }

  async function failLoginsSpreadOverIPs (count: number, password: string, otpToken?: string) {
    for (let i = 0; i < count; i++) {
      await failLogin(password, otpToken, xForwardedForAt(i))
    }
  }

  async function expectLockedLogin (password: string, otpToken?: string) {
    const { body } = await server.login.loginAndGetResponse({
      user: { username: userUsername, password },
      otpToken,
      expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
    })

    expectLockout(body as unknown as PeerTubeProblemDocument)
  }

  before(async function () {
    this.timeout(30000)

    const port = await MockSmtpServer.Instance.collectEmails(emails)

    // Increase the IP based login rate limit so this test only triggers the per-account lockout
    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          window: '5 minutes',
          max: 1000
        }
      },
      ...ConfigCommand.getEmailOverrideConfig(port)
    })

    await setAccessTokensToServers([ server ])

    const res = await server.users.generate(userUsername)
    userId = res.userId
    userPassword = res.password
    userToken = res.token
  })

  it('Should not lock the account below the failure threshold', async function () {
    this.timeout(30000)

    await failLoginsSpreadOverIPs(maxFailures - 1, 'invalid password')

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })

    await waitJobs(server)
    expectLockedAccountEmailsCount(0)
  })

  it('Should have reset the counter on successful login', async function () {
    this.timeout(30000)

    await failLoginsSpreadOverIPs(maxFailures - 1, 'invalid password')

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })

    await waitJobs(server)
    expectLockedAccountEmailsCount(0)
  })

  it('Should not lock the account from a single IP alone', async function () {
    this.timeout(30000)

    for (let i = 0; i < maxFailures * 2; i++) {
      await failLogin('invalid password')
    }

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })

    await waitJobs(server)
    expectLockedAccountEmailsCount(0)
  })

  it('Should lock the account after too many password failures spread over several IPs', async function () {
    this.timeout(30000)

    await failLoginsSpreadOverIPs(maxFailures, 'invalid password')

    // Even with the correct password
    await expectLockedLogin(userPassword)

    // And of course with an invalid one
    await expectLockedLogin('invalid password')

    await waitJobs(server)

    // Only 1 email, even though 2 more requests hit the account after it was already locked
    expectLockedAccountEmailsCount(1)
  })

  it('Should unlock the account after the lockout expired', async function () {
    this.timeout(30000)

    await wait(lifetimeMs + 2000)

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })
  })

  it('Should also lock the account on OTP failures', async function () {
    this.timeout(60000)

    // Enable two factor auth
    const { otpRequest } = await server.twoFactor.request({ userId, token: userToken, currentPassword: userPassword })
    await server.twoFactor.confirmRequest({
      userId,
      token: userToken,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate(),
      requestToken: otpRequest.requestToken
    })

    for (let i = 0; i < maxFailures; i++) {
      const body = await failLogin(userPassword, '123456', xForwardedForAt(i))
      expect(body.code).to.equal(ServerErrorCode.INVALID_TWO_FACTOR)
    }

    // Locked, even with the correct password and OTP token
    await expectLockedLogin(userPassword, TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate())

    await wait(lifetimeMs + 2000)

    await server.login.loginAndGetResponse({
      user: { username: userUsername, password: userPassword },
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate(),
      expectedStatus: HttpStatusCode.OK_200
    })

    await waitJobs(server)

    // The previous lock (password failures) already sent 1 email, this OTP-triggered lock sends a 2nd one
    expectLockedAccountEmailsCount(2)
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
