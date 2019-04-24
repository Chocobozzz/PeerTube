/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  makePutBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../../../shared/extra-utils'

describe('Test server redundancy API validators', function () {
  let servers: ServerInfo[]
  let userAccessToken = null

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const user = {
      username: 'user1',
      password: 'password'
    }

    await createUser({ url: servers[ 0 ].url, accessToken: servers[ 0 ].accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(servers[0], user)
  })

  describe('When updating redundancy', function () {
    const path = '/api/v1/server/redundancy'

    it('Should fail with an invalid token', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: 'fake_token',
        statusCodeExpected: 401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })

    it('Should fail if we do not follow this server', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/example.com',
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        statusCodeExpected: 404
      })
    })

    it('Should fail without de redundancyAllowed param', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { blabla: true },
        token: servers[0].accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        statusCodeExpected: 204
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
