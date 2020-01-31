/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  userLogin
} from '../../../../shared/extra-utils'
import { UserRole } from '../../../../shared/models/users'

async function testEndpoints (server: ServerInfo, token: string, filter: string, statusCodeExpected: number) {
  const paths = [
    '/api/v1/video-channels/root_channel/videos',
    '/api/v1/accounts/root/videos',
    '/api/v1/videos',
    '/api/v1/search/videos'
  ]

  for (const path of paths) {
    await makeGetRequest({
      url: server.url,
      path,
      token,
      query: {
        filter
      },
      statusCodeExpected
    })
  }
}

describe('Test videos filters', function () {
  let server: ServerInfo
  let userAccessToken: string
  let moderatorAccessToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const user = { username: 'user1', password: 'my super password' }
    await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(server, user)

    const moderator = { username: 'moderator', password: 'my super password' }
    await createUser(
      {
        url: server.url,
        accessToken: server.accessToken,
        username: moderator.username,
        password: moderator.password,
        videoQuota: undefined,
        videoQuotaDaily: undefined,
        role: UserRole.MODERATOR
      }
    )
    moderatorAccessToken = await userLogin(server, moderator)
  })

  describe('When setting a video filter', function () {

    it('Should fail with a bad filter', async function () {
      await testEndpoints(server, server.accessToken, 'bad-filter', 400)
    })

    it('Should succeed with a good filter', async function () {
      await testEndpoints(server, server.accessToken, 'local', 200)
    })

    it('Should fail to list all-local with a simple user', async function () {
      await testEndpoints(server, userAccessToken, 'all-local', 401)
    })

    it('Should succeed to list all-local with a moderator', async function () {
      await testEndpoints(server, moderatorAccessToken, 'all-local', 200)
    })

    it('Should succeed to list all-local with an admin', async function () {
      await testEndpoints(server, server.accessToken, 'all-local', 200)
    })

    // Because we cannot authenticate the user on the RSS endpoint
    it('Should fail on the feeds endpoint with the all-local filter', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/feeds/videos.json',
        statusCodeExpected: 401,
        query: {
          filter: 'all-local'
        }
      })
    })

    it('Should succeed on the feeds endpoint with the local filter', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/feeds/videos.json',
        statusCodeExpected: 200,
        query: {
          filter: 'local'
        }
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
