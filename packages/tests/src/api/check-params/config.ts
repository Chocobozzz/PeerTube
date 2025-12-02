/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { expect } from 'chai'
import { omit } from '@peertube/peertube-core-utils'
import { ActorImageType, CustomConfig, HttpStatusCode, LogoType } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePutBodyRequest,
  makeUploadRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import merge from 'lodash-es/merge.js'
import { DeepPartial } from '../../../../typescript-utils/src/types.js'

describe('Test config API validators', function () {
  const path = '/api/v1/config/custom'
  let server: PeerTubeServer
  let userAccessToken: string

  let updateParams: CustomConfig

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    updateParams = await server.config.getCustomConfig()

    const user = {
      username: 'user1',
      password: 'password'
    }
    await server.users.create({ username: user.username, password: user.password })
    userAccessToken = await server.login.getAccessToken(user)
  })

  describe('When getting the configuration', function () {
    it('Should fail without token', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When updating the configuration', function () {
    it('Should fail without token', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail if it misses a key', async function () {
      const newUpdateParams = { ...updateParams, admin: omit(updateParams.admin, [ 'email' ]) }

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad default NSFW policy', async function () {
      const newUpdateParams = merge({}, updateParams, {
        instance: {
          defaultNSFWPolicy: 'hello'
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad default comment policy', async function () {
      const newUpdateParams = merge({}, updateParams, {
        defaults: {
          publish: {
            commentsPolicy: 11
          }
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail if email disabled and signup requires email verification', async function () {
      // opposite scenario - success when enable enabled - covered via tests/api/users/user-verification.ts
      const newUpdateParams = merge({}, updateParams, {
        signup: {
          enabled: true,
          limit: 5,
          requiresApproval: true,
          requiresEmailVerification: true
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a disabled web videos & hls transcoding', async function () {
      const newUpdateParams = merge({}, updateParams, {
        transcoding: {
          enabled: true,
          hls: {
            enabled: false
          },
          webVideos: {
            enabled: false
          }
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a disabled http upload & enabled sync', async function () {
      const newUpdateParams: CustomConfig = merge({}, {}, updateParams, {
        import: {
          videos: {
            http: { enabled: false }
          },
          videoChannelSynchronization: { enabled: true }
        }
      })

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid search configuration', async function () {
      const newUpdateParams = merge(
        {},
        {},
        updateParams,
        {
          search: {
            remoteUri: {
              users: false
            },
            searchIndex: {
              enabled: true
            }
          }
        } satisfies DeepPartial<CustomConfig>
      )

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    describe('Browse videos section', function () {
      it('Should fail with an invalid default sort', async function () {
        const newUpdateParams: CustomConfig = merge({}, {}, updateParams, {
          client: {
            browseVideos: {
              defaultSort: 'hello'
            }
          }
        })

        const response = await makePutBodyRequest({
          url: server.url,
          path,
          fields: newUpdateParams,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })

        expect(response.body.detail).to.equal(
          'Browse videos default sort should be -publishedAt or -originallyPublishedAt ' +
          'or name or -trending or -hot or -likes or -views, instead of hello'
        )
      })

      it('Should fail with a trending default sort & disabled trending algorithm', async function () {
        const newUpdateParams: CustomConfig = merge({}, {}, updateParams, {
          trending: {
            videos: {
              algorithms: {
                enabled: [ 'hot', 'most-liked' ]
              }
            }
          },
          client: {
            browseVideos: {
              defaultSort: '-trending'
            }
          }
        })

        const response = await makePutBodyRequest({
          url: server.url,
          path,
          fields: newUpdateParams,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })

        expect(response.body.detail).to.equal(
          'Trending videos algorithm most-viewed should be enabled ' +
          'if browse videos default sort is -trending'
        )
      })

      it('Should fail with an invalid default scope', async function () {
        const newUpdateParams: CustomConfig = merge({}, {}, updateParams, {
          client: {
            browseVideos: {
              defaultScope: 'hello'
            }
          }
        })

        const response = await makePutBodyRequest({
          url: server.url,
          path,
          fields: newUpdateParams,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })

        expect(response.body.detail).to.equal(
          'Browse videos default scope should be local or federated, instead of hello'
        )
      })
    })
  })

  describe('When deleting the configuration', function () {
    it('Should fail without token', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('Updating instance image/logo', function () {
    const toTest = [
      { path: '/api/v1/config/instance-banner/pick', attachName: 'bannerfile' },
      { path: '/api/v1/config/instance-avatar/pick', attachName: 'avatarfile' },
      { path: '/api/v1/config/instance-logo/favicon/pick', attachName: 'logofile' },
      { path: '/api/v1/config/instance-logo/header-square/pick', attachName: 'logofile' },
      { path: '/api/v1/config/instance-logo/header-wide/pick', attachName: 'logofile' },
      { path: '/api/v1/config/instance-logo/opengraph/pick', attachName: 'logofile' }
    ]

    it('Should fail with an incorrect input file', async function () {
      for (const { attachName, path } of toTest) {
        const attaches = { [attachName]: buildAbsoluteFixturePath('video_short.mp4') }

        await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields: {}, attaches })
      }
    })

    it('Should fail with a big file', async function () {
      for (const { attachName, path } of toTest) {
        const attaches = { [attachName]: buildAbsoluteFixturePath('avatar-big.png') }

        await makeUploadRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields: {},
          attaches,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }
    })

    it('Should fail without token', async function () {
      for (const { attachName, path } of toTest) {
        const attaches = { [attachName]: buildAbsoluteFixturePath('avatar.png') }

        await makeUploadRequest({
          url: server.url,
          path,
          fields: {},
          attaches,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      }
    })

    it('Should fail without the appropriate rights', async function () {
      for (const { attachName, path } of toTest) {
        const attaches = { [attachName]: buildAbsoluteFixturePath('avatar.png') }

        await makeUploadRequest({
          url: server.url,
          path,
          token: userAccessToken,
          fields: {},
          attaches,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const { attachName, path } of toTest) {
        const attaches = { [attachName]: buildAbsoluteFixturePath('avatar.png') }

        await makeUploadRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields: {},
          attaches,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      }
    })
  })

  describe('Deleting instance image', function () {
    const types = [ ActorImageType.BANNER, ActorImageType.AVATAR ]

    it('Should fail without token', async function () {
      for (const type of types) {
        await server.config.deleteInstanceImage({ type, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      }
    })

    it('Should fail without the appropriate rights', async function () {
      for (const type of types) {
        await server.config.deleteInstanceImage({ type, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const type of types) {
        await server.config.deleteInstanceImage({ type })
      }
    })
  })

  describe('Deleting instance logos', function () {
    const types: LogoType[] = [ 'favicon', 'header-square', 'header-wide', 'opengraph' ]

    it('Should fail without token', async function () {
      for (const type of types) {
        await server.config.deleteInstanceLogo({ type, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      }
    })

    it('Should fail without the appropriate rights', async function () {
      for (const type of types) {
        await server.config.deleteInstanceLogo({ type, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const type of types) {
        await server.config.deleteInstanceLogo({ type })
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
