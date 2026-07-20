/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, ServerErrorCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  TwoFactorCommand
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test login lockout', function () {
  let server: PeerTubeServer

  const userUsername = 'user1'
  let userId: number
  let userPassword: string
  let userToken: string

  // Sync with rates_limit.login_lockout in config/test.yaml (window is 5 seconds on a test instance)
  const maxFailures = 10
  const lifetimeMs = 5000

  function expectLockout (body: PeerTubeProblemDocument) {
    expect(body.code).to.equal(ServerErrorCode.TOO_MANY_LOGIN_FAILURES)
  }

  async function failLogin (password: string, otpToken?: string) {
    const { body } = await server.login.loginAndGetResponse({
      user: { username: userUsername, password },
      otpToken,
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    return body as unknown as PeerTubeProblemDocument
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

    // Increase the IP based login rate limit so this test only triggers the per-account lockout
    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          window: '5 minutes',
          max: 1000
        }
      }
    })

    await setAccessTokensToServers([ server ])

    const res = await server.users.generate(userUsername)
    userId = res.userId
    userPassword = res.password
    userToken = res.token
  })

  it('Should not lock the account below the failure threshold', async function () {
    this.timeout(30000)

    for (let i = 0; i < maxFailures - 1; i++) {
      await failLogin('invalid password')
    }

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })
  })

  it('Should have reset the counter on successful login', async function () {
    this.timeout(30000)

    for (let i = 0; i < maxFailures - 1; i++) {
      await failLogin('invalid password')
    }

    await server.login.login({
      user: { username: userUsername, password: userPassword },
      expectedStatus: HttpStatusCode.OK_200
    })
  })

  it('Should lock the account after too many password failures', async function () {
    this.timeout(30000)

    for (let i = 0; i < maxFailures; i++) {
      await failLogin('invalid password')
    }

    // Even with the correct password
    await expectLockedLogin(userPassword)

    // And of course with an invalid one
    await expectLockedLogin('invalid password')
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
      const body = await failLogin(userPassword, '123456')
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
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
