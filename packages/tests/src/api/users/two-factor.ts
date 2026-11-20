/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  TwoFactorCommand
} from '@peertube/peertube-server-commands'
import { runTwoFactorTests, TwoFactorTestUser } from '@tests/shared/two-factor.js'

describe('Test users two factor authentication', function () {
  let server: PeerTubeServer

  const user = {} as TwoFactorTestUser

  // Sync with rates_limit.password_confirmation.max
  const maxPasswordChecks = 10

  // Sync with rates_limit.login.max of test.yaml
  const maxLogins = 20

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const { userId, password, token } = await server.users.generate('user1')
    Object.assign(user, { server, userId, token, username: 'user1', password })
  })

  runTwoFactorTests(user)

  it('Should rate limit current password checks', async function () {
    this.timeout(60000)

    const { userId, token, password } = await server.users.generate('user2')

    for (let i = 0; i < maxPasswordChecks; i++) {
      await server.twoFactor.request({ userId, token, currentPassword: 'incorrect password', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    }

    await server.twoFactor.request({ userId, token, currentPassword: password, expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
  })

  it('Should not count successful current password checks', async function () {
    this.timeout(60000)

    const { userId, token, password } = await server.users.generate('user6')

    for (let i = 0; i < maxPasswordChecks + 2; i++) {
      await server.twoFactor.request({ userId, token, currentPassword: 'incorrect password', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await server.twoFactor.request({ userId, token, currentPassword: password })
    }
  })

  it('Should revoke the other sessions of the user when enabling two factor', async function () {
    const { userId, token, password } = await server.users.generate('user3')
    const otherToken = await server.login.getAccessToken({ username: 'user3', password })

    const { otpRequest } = await server.twoFactor.request({ userId, token, currentPassword: password })
    await server.twoFactor.confirmRequest({
      userId,
      token,
      otpToken: TwoFactorCommand.buildOTP({ secret: otpRequest.secret }).generate(),
      requestToken: otpRequest.requestToken
    })

    await server.users.getMyInfo({ token })
    await server.users.getMyInfo({ token: otherToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should rate limit current password checks when updating my account', async function () {
    this.timeout(60000)

    const { token, password } = await server.users.generate('user4')

    for (let i = 0; i < maxPasswordChecks; i++) {
      await server.users.updateMe({
        token,
        currentPassword: 'incorrect password',
        password: 'my new password',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    }

    await server.users.updateMe({
      token,
      currentPassword: password,
      password: 'my new password',
      expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
    })

    await server.users.updateMe({ token, displayName: 'new display name' })
  })

  it('Should not bypass the login rate limit with an admin token', async function () {
    this.timeout(60000)

    const { password } = await server.users.generate('user5')

    // Use another IP: the login limiter counts the logins of the previous tests
    const xForwardedFor = '203.0.113.42'

    for (let i = 0; i < maxLogins; i++) {
      await server.login.login({
        user: { username: 'user5', password: 'incorrect password' },
        token: server.accessToken,
        xForwardedFor,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    }

    await server.login.login({
      user: { username: 'user5', password },
      token: server.accessToken,
      xForwardedFor,
      expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
