/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { runTwoFactorTests, TwoFactorTestUser } from '@tests/shared/two-factor.js'

describe('Test users two factor authentication', function () {
  let server: PeerTubeServer

  const user = {} as TwoFactorTestUser

  // Sync with rates_limit.login.max of test.yaml
  const maxPasswordChecks = 20

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

  after(async function () {
    await cleanupTests([ server ])
  })
})
