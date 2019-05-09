/* tslint:disable:no-unused-expression */

import { omit } from 'lodash'
import 'mocha'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'

import {
  createUser, flushTests, killallServers, makeDeleteRequest, makeGetRequest, makePutBodyRequest, flushAndRunServer, ServerInfo,
  setAccessTokensToServers, userLogin, immutableAssign, cleanupTests
} from '../../../../shared/extra-utils'

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
      isNSFW: true,
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
      },
      captions: {
        size: 3
      }
    },
    signup: {
      enabled: false,
      limit: 5,
      requiresEmailVerification: false
    },
    admin: {
      email: 'superadmin1@example.com'
    },
    contactForm: {
      enabled: false
    },
    user: {
      videoQuota: 5242881,
      videoQuotaDaily: 318742
    },
    transcoding: {
      enabled: true,
      allowAdditionalExtensions: true,
      threads: 1,
      resolutions: {
        '240p': false,
        '360p': true,
        '480p': true,
        '720p': false,
        '1080p': false
      },
      hls: {
        enabled: false
      }
    },
    import: {
      videos: {
        http: {
          enabled: false
        },
        torrent: {
          enabled: false
        }
      }
    },
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: false
        }
      }
    },
    followers: {
      instance: {
        enabled: false,
        manualApproval: true
      }
    }
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'password'
    }
    await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
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

    it('Should fail if email disabled and signup requires email verification', async function () {
      // opposite scenario - success when enable enabled - covered via tests/api/users/user-verification.ts
      const newUpdateParams = immutableAssign(updateParams, {
        signup: {
          enabled: true,
          limit: 5,
          requiresEmailVerification: true
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
    await cleanupTests([ server ])
  })
})
