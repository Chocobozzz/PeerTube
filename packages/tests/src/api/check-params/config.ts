/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import merge from 'lodash-es/merge.js'
import { omit } from '@peertube/peertube-core-utils'
import { ActorImageType, CustomConfig, HttpStatusCode } from '@peertube/peertube-models'
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
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'

describe('Test config API validators', function () {
  const path = '/api/v1/config/custom'
  let server: PeerTubeServer
  let userAccessToken: string

  const updateParams: CustomConfig = {
    instance: {
      name: 'PeerTube updated',
      shortDescription: 'my short description',
      description: 'my super description',
      terms: 'my super terms',
      codeOfConduct: 'my super coc',

      creationReason: 'my super reason',
      moderationInformation: 'my super moderation information',
      administrator: 'Kuja',
      maintenanceLifetime: 'forever',
      businessModel: 'my super business model',
      hardwareInformation: '2vCore 3GB RAM',

      languages: [ 'en', 'es' ],
      categories: [ 1, 2 ],

      isNSFW: true,
      defaultNSFWPolicy: 'blur',

      defaultClientRoute: '/videos/recently-added',

      customizations: {
        javascript: 'alert("coucou")',
        css: 'body { background-color: red; }'
      }
    },
    theme: {
      default: 'default'
    },
    services: {
      twitter: {
        username: '@MySuperUsername'
      }
    },
    client: {
      videos: {
        miniature: {
          preferAuthorDisplayName: false
        }
      },
      menu: {
        login: {
          redirectOnSingleExternalAuth: false
        }
      }
    },
    cache: {
      previews: {
        size: 2
      },
      captions: {
        size: 3
      },
      torrents: {
        size: 4
      },
      storyboards: {
        size: 5
      }
    },
    signup: {
      enabled: false,
      limit: 5,
      requiresApproval: false,
      requiresEmailVerification: false,
      minimumAge: 16
    },
    admin: {
      email: 'superadmin1@example.com'
    },
    contactForm: {
      enabled: false
    },
    user: {
      history: {
        videos: {
          enabled: true
        }
      },
      videoQuota: 5242881,
      videoQuotaDaily: 318742,
      defaultChannelName: 'Main $1 channel'
    },
    videoChannels: {
      maxPerUser: 20
    },
    transcoding: {
      enabled: true,
      remoteRunners: {
        enabled: true
      },
      allowAdditionalExtensions: true,
      allowAudioFiles: true,
      concurrency: 1,
      threads: 1,
      profile: 'vod_profile',
      resolutions: {
        '0p': false,
        '144p': false,
        '240p': false,
        '360p': true,
        '480p': true,
        '720p': false,
        '1080p': false,
        '1440p': false,
        '2160p': false
      },
      alwaysTranscodeOriginalResolution: false,
      webVideos: {
        enabled: true
      },
      hls: {
        enabled: false
      }
    },
    live: {
      enabled: true,

      allowReplay: false,
      latencySetting: {
        enabled: false
      },
      maxDuration: 30,
      maxInstanceLives: -1,
      maxUserLives: 50,

      transcoding: {
        enabled: true,
        remoteRunners: {
          enabled: true
        },
        threads: 4,
        profile: 'live_profile',
        resolutions: {
          '144p': true,
          '240p': true,
          '360p': true,
          '480p': true,
          '720p': true,
          '1080p': true,
          '1440p': true,
          '2160p': true
        },
        alwaysTranscodeOriginalResolution: false
      }
    },
    videoStudio: {
      enabled: true,
      remoteRunners: {
        enabled: true
      }
    },
    videoFile: {
      update: {
        enabled: true
      }
    },
    import: {
      videos: {
        concurrency: 1,
        http: {
          enabled: false
        },
        torrent: {
          enabled: false
        }
      },
      videoChannelSynchronization: {
        enabled: false,
        maxPerUser: 10
      },
      users: {
        enabled: false
      }
    },
    export: {
      users: {
        enabled: false,
        maxUserVideoQuota: 40,
        exportExpiration: 10
      }
    },
    trending: {
      videos: {
        algorithms: {
          enabled: [ 'hot', 'most-viewed', 'most-liked' ],
          default: 'most-viewed'
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
    },
    followings: {
      instance: {
        autoFollowBack: {
          enabled: true
        },
        autoFollowIndex: {
          enabled: true,
          indexUrl: 'https://index.example.com'
        }
      }
    },
    broadcastMessage: {
      enabled: true,
      dismissable: true,
      message: 'super message',
      level: 'warning'
    },
    search: {
      remoteUri: {
        users: true,
        anonymous: true
      },
      searchIndex: {
        enabled: true,
        url: 'https://search.joinpeertube.org',
        disableLocalSearch: true,
        isDefaultSearch: true
      }
    },
    storyboards: {
      enabled: false
    }
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

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
      const newUpdateParams = {
        ...updateParams,

        instance: {
          defaultNSFWPolicy: 'hello'
        }
      }

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
      const newUpdateParams = {
        ...updateParams,

        signup: {
          enabled: true,
          limit: 5,
          requiresApproval: true,
          requiresEmailVerification: true
        }
      }

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a disabled web videos & hls transcoding', async function () {
      const newUpdateParams = {
        ...updateParams,

        transcoding: {
          hls: {
            enabled: false
          },
          web_videos: {
            enabled: false
          }
        }
      }

      await makePutBodyRequest({
        url: server.url,
        path,
        fields: newUpdateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a disabled http upload & enabled sync', async function () {
      const newUpdateParams: CustomConfig = merge({}, updateParams, {
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

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: updateParams,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
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

  describe('Updating instance image', function () {
    const toTest = [
      { path: '/api/v1/config/instance-banner/pick', attachName: 'bannerfile' },
      { path: '/api/v1/config/instance-avatar/pick', attachName: 'avatarfile' }
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

  after(async function () {
    await cleanupTests([ server ])
  })
})
