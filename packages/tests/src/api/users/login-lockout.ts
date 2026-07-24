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

  // A locked account must return the exact same error as invalid credentials: a distinct status/code here
  // would let an attacker use the lockout itself as a username-enumeration oracle
  function expectGenericInvalidGrant (body: PeerTubeProblemDocument) {
    expect(body.code).to.equal(ServerErrorCode.INVALID_GRANT)
  }

  function expectLockedAccountEmailsCount (count: number) {
    // Successful logins also send a notification email, so only consider the lockout ones
    const lockedAccountEmails = emails.filter(e => e['subject'].includes('temporarily locked'))

    expect(lockedAccountEmails).to.have.lengthOf(count)
    if (count === 0) return

    const email = lockedAccountEmails[count - 1]
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

  // Even with the correct password/OTP, a locked account must still be rejected, with a body
  // indistinguishable from a plain wrong-credentials response (see expectGenericInvalidGrant)
  async function expectLockedLogin (password: string, otpToken?: string) {
    const { body } = await server.login.loginAndGetResponse({
      user: { username: userUsername, password },
      otpToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    expectGenericInvalidGrant(body as unknown as PeerTubeProblemDocument)
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

  it('Should lock the account after too many failures without leaking it over HTTP', async function () {
    this.timeout(30000)

    const { body: unknownUserBody } = await server.login.loginAndGetResponse({
      user: { username: 'a-username-that-does-not-exist', password: 'whatever' },
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    await failLoginsSpreadOverIPs(maxFailures, 'invalid password')

    // Even with the correct password
    await expectLockedLogin(userPassword)

    // And of course with an invalid one
    await expectLockedLogin('invalid password')

    // The locked-account error must be indistinguishable from the "unknown username" one: same status,
    // same generic code, same message. Otherwise the lockout itself becomes a username-enumeration oracle
    const { body: lockedBody } = await server.login.loginAndGetResponse({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    const unknownUserProblem = unknownUserBody as unknown as PeerTubeProblemDocument
    const lockedProblem = lockedBody as unknown as PeerTubeProblemDocument

    expectGenericInvalidGrant(unknownUserProblem)
    expectGenericInvalidGrant(lockedProblem)
    expect(lockedProblem.detail).to.equal(unknownUserProblem.detail)

    await waitJobs(server)

    // The lock is real, it is just not observable over HTTP: only the account owner's email reveals it
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

    // Locked, even with the correct password and OTP token, and still the same generic error
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
