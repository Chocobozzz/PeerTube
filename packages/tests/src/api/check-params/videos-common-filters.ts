/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType, UserRole, VideoInclude, VideoPrivacy, VideosCommonQuery } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test video filters validators', function () {
  let server: PeerTubeServer
  let userAccessToken: string
  let moderatorAccessToken: string

  const validIncludes = [
    VideoInclude.NONE,
    VideoInclude.BLOCKED_OWNER,
    VideoInclude.NOT_PUBLISHED_STATE | VideoInclude.BLACKLISTED,
    VideoInclude.SOURCE
  ]

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const user = { username: 'user1', password: 'my super password' }
    await server.users.create({ username: user.username, password: user.password })
    userAccessToken = await server.login.getAccessToken(user)

    const moderator = { username: 'moderator', password: 'my super password' }
    await server.users.create({ username: moderator.username, password: moderator.password, role: UserRole.MODERATOR })

    moderatorAccessToken = await server.login.getAccessToken(moderator)
  })

  async function testEndpoints (
    options:
      & Pick<
        VideosCommonQuery,
        | 'isLocal'
        | 'include'
        | 'privacyOneOf'
        | 'autoTagOneOf'
        | 'excludeAlreadyWatched'
        | 'nsfw'
        | 'nsfwFlagsExcluded'
        | 'nsfwFlagsIncluded'
      >
      & {
        token?: string
        expectedStatus: HttpStatusCodeType
        unauthenticatedUser?: boolean // default false
        skipMyVideos?: boolean // default  false
        filter?: string
      }
  ) {
    const paths = [
      '/api/v1/video-channels/root_channel/videos',
      '/api/v1/accounts/root/videos',
      '/api/v1/videos',
      '/api/v1/search/videos'
    ]

    if (options.unauthenticatedUser !== true && options.skipMyVideos !== true) {
      paths.push('/api/v1/users/me/videos')
    }

    for (const path of paths) {
      const token = options.unauthenticatedUser
        ? undefined
        : options.token || server.accessToken

      await makeGetRequest({
        url: server.url,
        path,
        token,
        query: pick(options, [
          'isLocal',
          'privacyOneOf',
          'autoTagOneOf',
          'include',
          'excludeAlreadyWatched',
          'filter',
          'nsfw',
          'nsfwFlagsExcluded',
          'nsfwFlagsIncluded'
        ]),
        expectedStatus: options.expectedStatus
      })
    }
  }

  describe('Local filter', function () {
    it('Should fail with the old filter query param', async function () {
      await testEndpoints({ filter: 'all-local', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed on the feeds endpoint with the local filter', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/feeds/videos.json',
        expectedStatus: HttpStatusCode.OK_200,
        query: {
          isLocal: true
        }
      })
    })
  })

  describe('Privacy', function () {
    it('Should fail with a bad privacyOneOf', async function () {
      await testEndpoints({ privacyOneOf: [ 'toto' ] as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with a good privacyOneOf', async function () {
      await testEndpoints({ privacyOneOf: [ VideoPrivacy.INTERNAL ], expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should fail to use privacyOneOf with a simple user', async function () {
      await testEndpoints({
        privacyOneOf: [ VideoPrivacy.INTERNAL ],
        token: userAccessToken,
        skipMyVideos: true,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed to use privacyOneOf to our own videos', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/users/me/videos',
        token: userAccessToken,
        query: {
          privacyOneOf: [ VideoPrivacy.INTERNAL ]
        },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('Auto tag', function () {
    it('Should fail to use autoTagOneOf with a simple user', async function () {
      await testEndpoints({
        autoTagOneOf: [ 'test' ],
        token: userAccessToken,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed to use autoTagOneOf with a moderator', async function () {
      await testEndpoints({
        autoTagOneOf: [ 'test' ],
        token: moderatorAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('Include', function () {
    it('Should fail with a bad include', async function () {
      await testEndpoints({ include: 'toto' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with a good include', async function () {
      for (const include of validIncludes) {
        await testEndpoints({ include, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should fail to include more videos with a simple user', async function () {
      for (const include of validIncludes) {
        await testEndpoints({ token: userAccessToken, include, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      }
    })

    it('Should succeed to list all local/all with a moderator', async function () {
      for (const include of validIncludes) {
        await testEndpoints({ token: moderatorAccessToken, include, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should succeed to list all local/all with an admin', async function () {
      for (const include of validIncludes) {
        await testEndpoints({ token: server.accessToken, include, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    // Because we cannot authenticate the user on the RSS endpoint
    it('Should fail on the feeds endpoint with the all filter', async function () {
      for (const include of [ VideoInclude.NOT_PUBLISHED_STATE ]) {
        await makeGetRequest({
          url: server.url,
          path: '/feeds/videos.json',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401,
          query: {
            include
          }
        })
      }
    })
  })

  describe('Exclude already watched', function () {
    it('Should fail when trying to exclude already watched videos for an unlogged user', async function () {
      await testEndpoints({ excludeAlreadyWatched: true, unauthenticatedUser: true, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed when trying to exclude already watched videos for a logged user', async function () {
      await testEndpoints({ token: userAccessToken, excludeAlreadyWatched: true, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('NSFW', function () {
    it('Should fail with an invalid nsfw', async function () {
      await testEndpoints({ nsfw: 'hello' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid nsfwFlagsExcluded', async function () {
      await testEndpoints({ nsfwFlagsExcluded: 'hello' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid nsfwFlagsIncluded', async function () {
      await testEndpoints({ nsfwFlagsIncluded: 'hello' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with conflicted nsfwFlagsIncluded and nsfwFlagsExcluded', async function () {
      await testEndpoints({
        nsfwFlagsIncluded: 1,
        nsfwFlagsExcluded: 1,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct NSFW params', async function () {
      await testEndpoints({
        nsfw: 'true',
        nsfwFlagsIncluded: 2,
        nsfwFlagsExcluded: 1,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
