/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ActorImageType, CustomConfig, HttpStatusCode, LogoType, VideoCommentPolicy, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  killallServers,
  makeActivityPubGetRequest,
  makeGetRequest,
  makeRawRequest,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { testAvatarSize, testFileExistsOnFSOrNot, testImage } from '@tests/shared/checks.js'
import { expect } from 'chai'
import { basename } from 'path'

function checkInitialConfig (server: PeerTubeServer, data: CustomConfig) {
  expect(data.instance.name).to.equal('PeerTube')
  expect(data.instance.shortDescription).to.equal(
    'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
  )
  expect(data.instance.description).to.equal('Welcome to this PeerTube instance!')

  expect(data.instance.terms).to.equal('No terms for now.')
  expect(data.instance.creationReason).to.be.empty
  expect(data.instance.codeOfConduct).to.be.empty
  expect(data.instance.moderationInformation).to.be.empty
  expect(data.instance.administrator).to.be.empty
  expect(data.instance.maintenanceLifetime).to.be.empty
  expect(data.instance.businessModel).to.be.empty
  expect(data.instance.hardwareInformation).to.be.empty
  expect(data.instance.serverCountry).to.be.empty
  expect(data.instance.support.text).to.be.empty
  expect(data.instance.defaultLanguage).to.equal('en')
  expect(data.instance.social.externalLink).to.be.empty
  expect(data.instance.social.blueskyLink).to.be.empty
  expect(data.instance.social.mastodonLink).to.be.empty
  expect(data.instance.social.xLink).to.be.empty

  expect(data.instance.languages).to.have.lengthOf(0)
  expect(data.instance.categories).to.have.lengthOf(0)

  expect(data.instance.defaultClientRoute).to.equal('/videos/browse')
  expect(data.instance.isNSFW).to.be.false
  expect(data.instance.defaultNSFWPolicy).to.equal('display')
  expect(data.instance.customizations.css).to.be.empty
  expect(data.instance.customizations.javascript).to.be.empty

  expect(data.services.twitter.username).to.equal('@Chocobozzz')

  expect(data.client.header.hideInstanceName).to.be.false
  expect(data.client.videos.miniature.preferAuthorDisplayName).to.be.false
  expect(data.client.browseVideos.defaultSort).to.equal('-publishedAt')
  expect(data.client.browseVideos.defaultScope).to.equal('federated')
  expect(data.client.menu.login.redirectOnSingleExternalAuth).to.be.false

  expect(data.cache.previews.size).to.equal(1)
  expect(data.cache.captions.size).to.equal(1)
  expect(data.cache.torrents.size).to.equal(1)
  expect(data.cache.storyboards.size).to.equal(1)

  expect(data.signup.enabled).to.be.true
  expect(data.signup.limit).to.equal(4)
  expect(data.signup.minimumAge).to.equal(16)
  expect(data.signup.requiresApproval).to.be.false
  expect(data.signup.requiresEmailVerification).to.be.false

  expect(data.admin.email).to.equal(`admin${server.internalServerNumber}@example.com`)
  expect(data.contactForm.enabled).to.be.true

  expect(data.user.history.videos.enabled).to.be.true
  expect(data.user.videoQuota).to.equal(5242880)
  expect(data.user.videoQuotaDaily).to.equal(-1)

  expect(data.videoChannels.maxPerUser).to.equal(20)

  expect(data.transcoding.enabled).to.be.false
  expect(data.transcoding.remoteRunners.enabled).to.be.false
  expect(data.transcoding.allowAdditionalExtensions).to.be.false
  expect(data.transcoding.allowAudioFiles).to.be.false
  expect(data.transcoding.threads).to.equal(2)
  expect(data.transcoding.concurrency).to.equal(2)
  expect(data.transcoding.profile).to.equal('default')
  expect(data.transcoding.resolutions['144p']).to.be.false
  expect(data.transcoding.resolutions['240p']).to.be.true
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.true
  expect(data.transcoding.resolutions['1080p']).to.be.true
  expect(data.transcoding.resolutions['1440p']).to.be.true
  expect(data.transcoding.resolutions['2160p']).to.be.true
  expect(data.transcoding.alwaysTranscodeOriginalResolution).to.be.true
  expect(data.transcoding.fps.max).to.equal(60)
  expect(data.transcoding.webVideos.enabled).to.be.true
  expect(data.transcoding.hls.enabled).to.be.true
  expect(data.transcoding.hls.splitAudioAndVideo).to.be.false
  expect(data.transcoding.originalFile.keep).to.be.false

  expect(data.live.enabled).to.be.false
  expect(data.live.allowReplay).to.be.false
  expect(data.live.latencySetting.enabled).to.be.true
  expect(data.live.maxDuration).to.equal(-1)
  expect(data.live.maxInstanceLives).to.equal(20)
  expect(data.live.maxUserLives).to.equal(3)
  expect(data.live.transcoding.enabled).to.be.false
  expect(data.live.transcoding.remoteRunners.enabled).to.be.false
  expect(data.live.transcoding.threads).to.equal(2)
  expect(data.live.transcoding.profile).to.equal('default')
  expect(data.live.transcoding.resolutions['0p']).to.be.false
  expect(data.live.transcoding.resolutions['144p']).to.be.false
  expect(data.live.transcoding.resolutions['240p']).to.be.false
  expect(data.live.transcoding.resolutions['360p']).to.be.false
  expect(data.live.transcoding.resolutions['480p']).to.be.false
  expect(data.live.transcoding.resolutions['720p']).to.be.false
  expect(data.live.transcoding.resolutions['1080p']).to.be.false
  expect(data.live.transcoding.resolutions['1440p']).to.be.false
  expect(data.live.transcoding.resolutions['2160p']).to.be.false
  expect(data.live.transcoding.alwaysTranscodeOriginalResolution).to.be.true
  expect(data.live.transcoding.fps.max).to.equal(60)

  expect(data.videoStudio.enabled).to.be.false
  expect(data.videoStudio.remoteRunners.enabled).to.be.false

  expect(data.videoTranscription.enabled).to.be.false
  expect(data.videoTranscription.remoteRunners.enabled).to.be.false

  expect(data.videoFile.update.enabled).to.be.false

  expect(data.import.videos.concurrency).to.equal(2)
  expect(data.import.videos.http.enabled).to.be.true
  expect(data.import.videos.torrent.enabled).to.be.true
  expect(data.import.videoChannelSynchronization.enabled).to.be.false
  expect(data.import.users.enabled).to.be.true
  expect(data.autoBlacklist.videos.ofUsers.enabled).to.be.false

  expect(data.followers.instance.enabled).to.be.true
  expect(data.followers.instance.manualApproval).to.be.false
  expect(data.followers.channels.enabled).to.be.true

  expect(data.followings.instance.autoFollowBack.enabled).to.be.false
  expect(data.followings.instance.autoFollowIndex.enabled).to.be.false
  expect(data.followings.instance.autoFollowIndex.indexUrl).to.equal('')

  expect(data.broadcastMessage.enabled).to.be.false
  expect(data.broadcastMessage.level).to.equal('info')
  expect(data.broadcastMessage.message).to.equal('')
  expect(data.broadcastMessage.dismissable).to.be.false

  expect(data.storyboards.enabled).to.be.true

  expect(data.export.users.enabled).to.be.true
  expect(data.export.users.exportExpiration).to.equal(1000 * 3600 * 48)
  expect(data.export.users.maxUserVideoQuota).to.equal(10737418240)

  expect(data.defaults.publish.commentsPolicy).to.equal(VideoCommentPolicy.ENABLED)
  expect(data.defaults.publish.downloadEnabled).to.be.true
  expect(data.defaults.publish.licence).to.be.null
  expect(data.defaults.publish.privacy).to.equal(VideoPrivacy.PUBLIC)
  expect(data.defaults.p2p.embed.enabled).to.be.true
  expect(data.defaults.p2p.webapp.enabled).to.be.true
  expect(data.defaults.player.theme).to.equal('galaxy')
  expect(data.defaults.player.autoPlay).to.be.true

  expect(data.email.body.signature).to.equal('')
  expect(data.email.subject.prefix).to.equal('[{{instanceName}}] ')

  expect(data.videoComments.acceptRemoteComments).to.be.true
}

function buildNewCustomConfig (server: PeerTubeServer): CustomConfig {
  return {
    instance: {
      name: 'PeerTube updated',
      shortDescription: 'my short description',
      description: 'my super description',
      terms: 'my super terms',
      codeOfConduct: 'my super coc',

      creationReason: 'my super creation reason',
      moderationInformation: 'my super moderation information',
      administrator: 'Kuja',
      maintenanceLifetime: 'forever',
      businessModel: 'my super business model',
      hardwareInformation: '2vCore 3GB RAM',

      languages: [ 'en', 'es' ],
      categories: [ 1, 2 ],

      isNSFW: true,
      defaultNSFWPolicy: 'warn' as 'warn',

      serverCountry: 'France',
      support: {
        text: 'My support text'
      },
      defaultLanguage: 'fr',
      social: {
        externalLink: 'https://joinpeertube.org/',
        mastodonLink: 'https://framapiaf.org/@peertube',
        blueskyLink: 'https://bsky.app/profile/joinpeertube.org',
        xLink: 'https://x.org/@joinpeertube'
      },

      defaultClientRoute: '/videos/recently-added',

      customizations: {
        javascript: 'alert("coucou")',
        css: 'body { background-color: red; }'
      }
    },
    theme: {
      default: 'default',
      customization: {
        primaryColor: '#001',
        foregroundColor: '#002',
        backgroundColor: '#003',
        backgroundSecondaryColor: '#004',
        menuForegroundColor: '#005',
        menuBackgroundColor: '#006',
        menuBorderRadius: '1px',
        headerForegroundColor: '#008',
        headerBackgroundColor: '#009',
        inputBorderRadius: '2px'
      }
    },
    services: {
      twitter: {
        username: '@Kuja'
      }
    },
    client: {
      header: {
        hideInstanceName: true
      },
      videos: {
        miniature: {
          preferAuthorDisplayName: true
        }
      },
      browseVideos: {
        defaultSort: '-trending',
        defaultScope: 'local'
      },
      menu: {
        login: {
          redirectOnSingleExternalAuth: true
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
      minimumAge: 10
    },
    admin: {
      email: `admin${server.internalServerNumber}@example.com`
    },
    contactForm: {
      enabled: false
    },
    user: {
      history: {
        videos: {
          enabled: false
        }
      },
      videoQuota: 5242881,
      videoQuotaDaily: 318742,
      defaultChannelName: 'Main $1 channel'
    },
    videoChannels: {
      maxPerUser: 24
    },
    transcoding: {
      enabled: true,
      remoteRunners: {
        enabled: true
      },
      originalFile: {
        keep: true
      },
      allowAdditionalExtensions: true,
      allowAudioFiles: true,
      threads: 1,
      concurrency: 3,
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
      fps: {
        max: 120
      },
      webVideos: {
        enabled: true
      },
      hls: {
        enabled: false,
        splitAudioAndVideo: true
      }
    },
    live: {
      enabled: true,
      allowReplay: true,
      latencySetting: {
        enabled: false
      },
      maxDuration: 5000,
      maxInstanceLives: -1,
      maxUserLives: 10,
      transcoding: {
        enabled: true,
        remoteRunners: {
          enabled: true
        },
        threads: 4,
        profile: 'live_profile',
        resolutions: {
          '0p': true,
          '144p': true,
          '240p': true,
          '360p': true,
          '480p': true,
          '720p': true,
          '1080p': true,
          '1440p': true,
          '2160p': true
        },
        alwaysTranscodeOriginalResolution: false,
        fps: {
          max: 144
        }
      }
    },
    videoStudio: {
      enabled: true,
      remoteRunners: {
        enabled: true
      }
    },
    videoTranscription: {
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
        concurrency: 4,
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
    trending: {
      videos: {
        algorithms: {
          enabled: [ 'hot', 'most-viewed', 'most-liked' ],
          default: 'hot'
        }
      }
    },
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: true
        }
      }
    },
    followers: {
      instance: {
        enabled: false,
        manualApproval: true
      },
      channels: {
        enabled: false
      }
    },
    followings: {
      instance: {
        autoFollowBack: {
          enabled: true
        },
        autoFollowIndex: {
          enabled: true,
          indexUrl: 'https://updated.example.com'
        }
      }
    },
    broadcastMessage: {
      enabled: true,
      level: 'error',
      message: 'super bad message',
      dismissable: true
    },
    search: {
      remoteUri: {
        anonymous: true,
        users: true
      },
      searchIndex: {
        enabled: true,
        url: 'https://search.joinpeertube.org',
        disableLocalSearch: true,
        isDefaultSearch: true
      }
    },
    storyboards: {
      enabled: false,
      remoteRunners: {
        enabled: true
      }
    },
    export: {
      users: {
        enabled: false,
        exportExpiration: 43,
        maxUserVideoQuota: 42
      }
    },
    defaults: {
      publish: {
        commentsPolicy: VideoCommentPolicy.REQUIRES_APPROVAL,
        downloadEnabled: false,
        licence: 2,
        privacy: VideoPrivacy.INTERNAL
      },
      p2p: {
        embed: {
          enabled: false
        },
        webapp: {
          enabled: true
        }
      },
      player: {
        autoPlay: false,
        theme: 'lucide'
      }
    },
    email: {
      body: {
        signature: 'my signature'
      },
      subject: {
        prefix: 'my prefix'
      }
    },
    videoComments: {
      acceptRemoteComments: false
    }
  }
}

describe('Test static config', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, { webadmin: { configuration: { edition: { allowed: false } } } })
    await setAccessTokensToServers([ server ])
  })

  it('Should tell the client that edits are not allowed', async function () {
    const data = await server.config.getConfig()

    expect(data.webadmin.configuration.edition.allowed).to.be.false
  })

  it('Should error when client tries to update', async function () {
    await server.config.updateCustomConfig({ newCustomConfig: buildNewCustomConfig(server), expectedStatus: 405 })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

describe('Test config', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
  })

  describe('Config keys', function () {
    it('Should have the correct default config', async function () {
      const data = await server.config.getConfig()

      expect(data.openTelemetry.metrics.enabled).to.be.false
      expect(data.openTelemetry.metrics.playbackStatsInterval).to.equal(15000)

      expect(data.views.videos.watchingInterval.anonymous).to.equal(5000)
      expect(data.views.videos.watchingInterval.users).to.equal(5000)

      expect(data.webrtc.stunServers).to.include('stun:stun.framasoft.org')
    })

    it('Should have a correct config on a server with registration enabled', async function () {
      const data = await server.config.getConfig()

      expect(data.signup.allowed).to.be.true
    })

    it('Should have a correct config on a server with registration enabled and a users limit', async function () {
      this.timeout(5000)

      await Promise.all([
        server.registrations.register({ username: 'user1' }),
        server.registrations.register({ username: 'user2' }),
        server.registrations.register({ username: 'user3' })
      ])

      const data = await server.config.getConfig()

      expect(data.signup.allowed).to.be.false
    })

    it('Should have the correct video allowed extensions', async function () {
      const data = await server.config.getConfig()

      expect(data.video.file.extensions).to.have.lengthOf(3)
      expect(data.video.file.extensions).to.contain('.mp4')
      expect(data.video.file.extensions).to.contain('.webm')
      expect(data.video.file.extensions).to.contain('.ogv')

      await server.videos.upload({ attributes: { fixture: 'video_short.mkv' }, expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415 })
      await server.videos.upload({ attributes: { fixture: 'sample.ogg' }, expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415 })

      expect(data.contactForm.enabled).to.be.true
    })

    it('Should get the customized configuration', async function () {
      const data = await server.config.getCustomConfig()

      checkInitialConfig(server, data)
    })

    it('Should update the customized configuration', async function () {
      await server.config.updateCustomConfig({ newCustomConfig: buildNewCustomConfig(server) })

      const data = await server.config.getCustomConfig()
      expect(data).to.deep.equal(buildNewCustomConfig(server))
    })

    it('Should have the correct updated video allowed extensions', async function () {
      this.timeout(30000)

      const data = await server.config.getConfig()

      expect(data.video.file.extensions).to.have.length.above(4)
      expect(data.video.file.extensions).to.contain('.mp4')
      expect(data.video.file.extensions).to.contain('.webm')
      expect(data.video.file.extensions).to.contain('.ogv')
      expect(data.video.file.extensions).to.contain('.flv')
      expect(data.video.file.extensions).to.contain('.wmv')
      expect(data.video.file.extensions).to.contain('.mkv')
      expect(data.video.file.extensions).to.contain('.mp3')
      expect(data.video.file.extensions).to.contain('.ogg')
      expect(data.video.file.extensions).to.contain('.flac')

      await server.videos.upload({ attributes: { fixture: 'video_short.mkv' }, expectedStatus: HttpStatusCode.OK_200 })
      await server.videos.upload({ attributes: { fixture: 'sample.ogg' }, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should have the configuration updated after a restart', async function () {
      this.timeout(30000)

      await killallServers([ server ])

      await server.run()

      const data = await server.config.getCustomConfig()

      expect(data).to.deep.equal(buildNewCustomConfig(server))
    })

    it('Should fetch the about information', async function () {
      const { instance } = await server.config.getAbout()

      expect(instance.name).to.equal('PeerTube updated')
      expect(instance.shortDescription).to.equal('my short description')
      expect(instance.description).to.equal('my super description')
      expect(instance.terms).to.equal('my super terms')
      expect(instance.codeOfConduct).to.equal('my super coc')

      expect(instance.creationReason).to.equal('my super creation reason')
      expect(instance.moderationInformation).to.equal('my super moderation information')
      expect(instance.administrator).to.equal('Kuja')
      expect(instance.maintenanceLifetime).to.equal('forever')
      expect(instance.businessModel).to.equal('my super business model')
      expect(instance.hardwareInformation).to.equal('2vCore 3GB RAM')

      expect(instance.languages).to.deep.equal([ 'en', 'es' ])
      expect(instance.categories).to.deep.equal([ 1, 2 ])

      expect(instance.banners).to.have.lengthOf(0)
    })

    it('Should remove the custom configuration', async function () {
      await server.config.deleteCustomConfig()

      const data = await server.config.getCustomConfig()
      checkInitialConfig(server, data)
    })

    it('Should enable/disable security headers', async function () {
      this.timeout(25000)

      {
        const res = await makeGetRequest({
          url: server.url,
          path: '/api/v1/config',
          expectedStatus: 200
        })

        expect(res.headers['x-frame-options']).to.exist
        expect(res.headers['x-powered-by']).to.equal('PeerTube')
      }

      await killallServers([ server ])

      const config = {
        security: {
          frameguard: { enabled: false },
          powered_by_header: { enabled: false }
        }
      }
      await server.run(config)

      {
        const res = await makeGetRequest({
          url: server.url,
          path: '/api/v1/config',
          expectedStatus: 200
        })

        expect(res.headers['x-frame-options']).to.not.exist
        expect(res.headers['x-powered-by']).to.not.exist
      }
    })
  })

  describe('Image files', function () {
    async function checkAndGetServerImages () {
      const { instance } = await server.config.getAbout()
      const htmlConfig = await server.config.getConfig()

      expect(instance.avatars).to.deep.equal(htmlConfig.instance.avatars)
      expect(instance.banners).to.deep.equal(htmlConfig.instance.banners)

      return htmlConfig.instance
    }

    describe('Banner', function () {
      const bannerUrls: string[] = []

      it('Should update instance banner', async function () {
        await server.config.updateInstanceImage({ type: ActorImageType.BANNER, fixture: 'banner.jpg' })

        const { banners } = await checkAndGetServerImages()

        expect(banners).to.have.lengthOf(2)

        for (const banner of banners) {
          await testImage({ url: banner.fileUrl, name: `banner-resized-${banner.width}.jpg` })
          await testFileExistsOnFSOrNot(server, 'avatars', basename(banner.fileUrl), true)

          bannerUrls.push(banner.fileUrl)
        }
      })

      it('Should re-update an existing instance banner', async function () {
        await server.config.updateInstanceImage({ type: ActorImageType.BANNER, fixture: 'banner.jpg' })
      })

      it('Should remove instance banner', async function () {
        await server.config.deleteInstanceImage({ type: ActorImageType.BANNER })

        const { banners } = await checkAndGetServerImages()
        expect(banners).to.have.lengthOf(0)

        for (const bannerUrl of bannerUrls) {
          await testFileExistsOnFSOrNot(server, 'avatars', basename(bannerUrl), false)
        }
      })
    })

    describe('Avatar', function () {
      const avatarUrls: string[] = []

      it('Should update instance avatar', async function () {
        for (const extension of [ '.png', '.gif' ]) {
          const fixture = 'avatar' + extension

          await server.config.updateInstanceImage({ type: ActorImageType.AVATAR, fixture })

          const { avatars } = await checkAndGetServerImages()

          for (const avatar of avatars) {
            await testAvatarSize({ url: server.url, avatar, imageName: `avatar-resized-${avatar.width}x${avatar.width}` })
            await testFileExistsOnFSOrNot(server, 'avatars', basename(avatar.fileUrl), true)

            avatarUrls.push(avatar.fileUrl)
          }
        }
      })

      it('Should have the avatars in the AP representation of the instance', async function () {
        const res = await makeActivityPubGetRequest(server.url, '/accounts/peertube')
        const object = res.body

        expect(object.icon).to.have.lengthOf(4)

        for (const icon of object.icon) {
          await makeRawRequest({ url: icon.url, expectedStatus: HttpStatusCode.OK_200 })
        }
      })

      it('Should remove instance avatar', async function () {
        await server.config.deleteInstanceImage({ type: ActorImageType.AVATAR })

        const { avatars } = await checkAndGetServerImages()
        expect(avatars).to.have.lengthOf(0)

        for (const avatarUrl of avatarUrls) {
          await testFileExistsOnFSOrNot(server, 'avatars', basename(avatarUrl), false)
        }
      })

      it('Should not have the avatars anymore in the AP representation of the instance', async function () {
        const res = await makeActivityPubGetRequest(server.url, '/accounts/peertube')
        const object = res.body

        expect(object.icon).to.not.exist
      })
    })

    describe('Logos', function () {
      describe('Favicon', function () {
        const logoPaths: string[] = []

        it('Should update instance favicon', async function () {
          for (const extension of [ '.png', '.gif' ]) {
            const fixture = 'avatar' + extension

            await server.config.updateInstanceLogo({ type: 'favicon', fixture })

            const htmlConfig = await server.config.getConfig()

            const favicons = htmlConfig.instance.logo.filter(l => l.type === 'favicon')
            expect(favicons).to.have.lengthOf(1)
            expect(favicons[0].width).to.equal(32)
            expect(favicons[0].height).to.equal(32)
            expect(favicons[0].isFallback).to.be.false
            expect(favicons[0].type).to.equal('favicon')

            logoPaths.push(favicons[0].fileUrl)

            await makeRawRequest({ url: favicons[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
            await testFileExistsOnFSOrNot(server, 'uploads/images', basename(favicons[0].fileUrl), true)
          }
        })

        it('Should remove instance favicon', async function () {
          await server.config.deleteInstanceLogo({ type: 'favicon' })

          const htmlConfig = await server.config.getConfig()

          const favicons = htmlConfig.instance.logo.filter(l => l.type === 'favicon')
          expect(favicons).to.have.lengthOf(1)
          expect(favicons[0].width).to.equal(32)
          expect(favicons[0].height).to.equal(32)
          expect(favicons[0].isFallback).to.be.true
          expect(favicons[0].type).to.equal('favicon')

          await makeRawRequest({ url: favicons[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })

          for (const logoPath of logoPaths) {
            await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logoPath), false)
          }
        })
      })

      describe('Header square icons', function () {
        const logoPaths: string[] = []

        it('Should update instance header square icon', async function () {
          for (const extension of [ '.png', '.gif' ]) {
            const fixture = 'avatar' + extension

            await server.config.updateInstanceLogo({ type: 'header-square', fixture })

            const htmlConfig = await server.config.getConfig()

            const logos = htmlConfig.instance.logo.filter(l => l.type === 'header-square')
            expect(logos).to.have.lengthOf(1)
            expect(logos[0].width).to.equal(48)
            expect(logos[0].height).to.equal(48)
            expect(logos[0].isFallback).to.be.false
            expect(logos[0].type).to.equal('header-square')

            logoPaths.push(logos[0].fileUrl)

            await makeRawRequest({ url: logos[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
            await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logos[0].fileUrl), true)
          }
        })

        it('Should remove instance header square icon', async function () {
          await server.config.deleteInstanceLogo({ type: 'header-square' })

          const htmlConfig = await server.config.getConfig()

          const logos = htmlConfig.instance.logo.filter(l => l.type === 'header-square')
          expect(logos).to.have.lengthOf(1)
          expect(logos[0].width).to.equal(34)
          expect(logos[0].height).to.equal(34)
          expect(logos[0].isFallback).to.be.true
          expect(logos[0].type).to.equal('header-square')

          await makeRawRequest({ url: logos[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })

          for (const logoPath of logoPaths) {
            await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logoPath), false)
          }
        })
      })

      describe('Header wide icons', function () {
        const logoPaths: string[] = []

        it('Should update instance header wide icon', async function () {
          const fixture = 'banner.jpg'

          await server.config.updateInstanceLogo({ type: 'header-wide', fixture })

          const htmlConfig = await server.config.getConfig()

          const logos = htmlConfig.instance.logo.filter(l => l.type === 'header-wide')
          expect(logos).to.have.lengthOf(1)
          expect(logos[0].width).to.equal(258)
          expect(logos[0].height).to.equal(48)
          expect(logos[0].isFallback).to.be.false
          expect(logos[0].type).to.equal('header-wide')

          logoPaths.push(logos[0].fileUrl)

          await makeRawRequest({ url: logos[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logos[0].fileUrl), true)
        })

        it('Should remove instance header wide icon', async function () {
          await server.config.deleteInstanceLogo({ type: 'header-wide' })

          const htmlConfig = await server.config.getConfig()

          const logos = htmlConfig.instance.logo.filter(l => l.type === 'header-wide')
          expect(logos).to.have.lengthOf(1)
          expect(logos[0].width).to.equal(34)
          expect(logos[0].height).to.equal(34)
          expect(logos[0].isFallback).to.be.true
          expect(logos[0].type).to.equal('header-wide')

          await makeRawRequest({ url: logos[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })

          for (const logoPath of logoPaths) {
            await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logoPath), false)
          }
        })
      })

      describe('Opengraph icons', function () {
        it('Should update instance opengraph icon', async function () {
          const fixture = 'banner.jpg'

          await server.config.updateInstanceLogo({ type: 'opengraph', fixture })

          const htmlConfig = await server.config.getConfig()

          const logos = htmlConfig.instance.logo.filter(l => l.type === 'opengraph')
          expect(logos).to.have.lengthOf(1)
          expect(logos[0].width).to.equal(1200)
          expect(logos[0].height).to.equal(650)
          expect(logos[0].isFallback).to.be.false
          expect(logos[0].type).to.equal('opengraph')

          await makeRawRequest({ url: logos[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          await testFileExistsOnFSOrNot(server, 'uploads/images', basename(logos[0].fileUrl), true)
        })

        it('Should remove instance opengraph icon', async function () {
          await server.config.deleteInstanceLogo({ type: 'opengraph' })

          const htmlConfig = await server.config.getConfig()

          const logos = htmlConfig.instance.logo.filter(l => l.type === 'opengraph')
          expect(logos).to.have.lengthOf(0)
        })
      })

      describe('Default logo', function () {
        before(async function () {
          await server.config.updateInstanceImage({ type: ActorImageType.AVATAR, fixture: 'avatar.png' })
        })

        it('Should default to the avatar logo for the favicon, header icons and opengraph', async function () {
          const htmlConfig = await server.config.getConfig()

          const types: LogoType[] = [ 'favicon', 'header-square', 'header-wide', 'opengraph' ]

          for (const type of types) {
            const logos = htmlConfig.instance.logo.filter(l => l.type === type)

            expect(logos).to.have.lengthOf(4)
            expect(logos[0].width).to.equal(48)
            expect(logos[0].height).to.equal(48)
            expect(logos[0].isFallback).to.be.true
            expect(logos[0].type).to.equal(type)

            await testImage({ url: logos[0].fileUrl, name: `avatar-resized-48x48.png` })
          }
        })

        after(async function () {
          await server.config.deleteInstanceImage({ type: ActorImageType.AVATAR })
        })
      })
    })
  })

  describe('Manifest', function () {
    before(async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          instance: {
            name: 'PeerTube manifest',
            shortDescription: 'description manifest'
          }
        }
      })
    })

    it('Should generate the manifest file without avatar', async function () {
      const { body } = await makeGetRequest({
        url: server.url,
        path: '/manifest.webmanifest',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(body.name).to.equal('PeerTube manifest')
      expect(body.short_name).to.equal(body.name)
      expect(body.description).to.equal('description manifest')

      const icon = body.icons.find(f => f.sizes === '192x192')
      expect(icon).to.exist
      expect(icon.src).to.equal('/client/assets/images/icons/icon-192x192.png')
    })

    it('Should generate the manifest with avatar', async function () {
      await server.config.updateInstanceImage({ type: ActorImageType.AVATAR, fixture: 'avatar.png' })

      const { body } = await makeGetRequest({
        url: server.url,
        path: '/manifest.webmanifest',
        expectedStatus: HttpStatusCode.OK_200
      })

      const icon = body.icons.find(f => f.sizes === '48x48')
      expect(icon).to.exist

      await testImage({ url: server.url + icon.src, name: `avatar-resized-48x48.png` })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

describe('YAML config', function () {
  let server: PeerTubeServer
  let userToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {
      user: {
        password_constraints: {
          min_length: 10
        }
      }
    })
    await setAccessTokensToServers([ server ])
  })

  it('Should update the minimum length of a password', async function () {
    await server.users.create({ username: 'user10', password: 'short', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    await server.users.create({ username: 'user10', password: 's'.repeat(10) })
  })

  it('Should still be able to login with an old password', async function () {
  })

  it('Should update the minimum length of a password but still allow to login', async function () {
    await server.kill()

    await server.run({
      user: {
        password_constraints: {
          min_length: 12
        }
      }
    })

    const res = await server.login.login({ user: { username: 'user10', password: 's'.repeat(10) } })
    userToken = res.access_token
  })

  it('Should be able to change the password', async function () {
    await server.users.updateMe({
      token: userToken,
      currentPassword: 's'.repeat(10),
      password: 'password',
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    await server.users.updateMe({
      token: userToken,
      currentPassword: 's'.repeat(10),
      password: 's'.repeat(12)
    })

    await server.login.login({ user: { username: 'user10', password: 's'.repeat(12) } })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
