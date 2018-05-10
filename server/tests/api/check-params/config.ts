/* tslint:disable:no-unused-expression */

import { omit } from 'lodash'
import 'mocha'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'

import {
  createUser, flushTests, killallServers, makeDeleteRequest, makeGetRequest, makePutBodyRequest, runServer, ServerInfo,
  setAccessTokensToServers, userLogin, immutableAssign
} from '../../utils'

describe('Test config API validators', function () {
  const path = '/api/v1/config/custom'
  let server: ServerInfo
  let userAccessToken: string
  const updateParams: CustomConfig = {
    instance: {
      name: 'PeerTube updated',
      shortDescription: 'my short description',
      description: 'my super description',
      terms: 'my super terms',
      defaultClientRoute: '/videos/recently-added',
      defaultNSFWPolicy: 'blur',
      customizations: {
        javascript: 'alert("coucou")',
        css: 'body { background-color: red; }'
      }
    },
    services: {
      twitter: {
        username: '@MySuperUsername',
        whitelisted: true
      }
    },
    cache: {
      previews: {
        size: 2
      }
    },
    signup: {
      enabled: false,
      limit: 5
    },
    admin: {
      email: 'superadmin1@example.com'
    },
    user: {
      videoQuota: 5242881
    },
    transcoding: {
      enabled: true,
      threads: 1,
      resolutions: {
        '240p': false,
        '360p': true,
        '480p': true,
        '720p': false,
        '1080p': false
      }
    }
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'password'
    }
    await createUser(server.url, server.accessToken, user.username, user.password)
    userAccessToken = await userLogin(server, user)
  })

  describe('When getting the configuration', function () {
    it('Should fail without token', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })
  })

  describe('When updating the configuration', function () {
    it('Should fail without token', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        statusCodeExpected: 401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })

    it('Should fail if it misses a key', async function () {
      const newUpdateParams = omit(updateParams, 'admin.email')

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should fail with a bad default NSFW policy', async function () {
      const newUpdateParams = immutableAssign(updateParams, {
        instance: {
          defaultNSFWPolicy: 'hello'
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should success with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        token: server.accessToken,
        statusCodeExpected: 200
      })
    })
  })

  describe('When deleting the configuration', function () {
    it('Should fail without token', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
