/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoCommentPolicy, VideoDetails, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'

describe('Test config defaults', function () {
  let server: PeerTubeServer
  let channelId: number

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    channelId = server.store.channel.id
  })

  describe('Default publish values', function () {

    before(async function () {
      const overrideConfig = {
        defaults: {
          publish: {
            comments_policy: 2,
            download_enabled: false,
            privacy: VideoPrivacy.INTERNAL,
            licence: 4
          }
        }
      }

      await server.kill()
      await server.run(overrideConfig)
    })

    const attributes = {
      name: 'video',
      downloadEnabled: undefined,
      commentsPolicy: undefined,
      licence: undefined,
      privacy: VideoPrivacy.PUBLIC // Privacy is mandatory for server
    }

    function checkVideo (video: VideoDetails) {
      expect(video.downloadEnabled).to.be.false
      expect(video.commentsPolicy.id).to.equal(VideoCommentPolicy.DISABLED)
      expect(video.commentsEnabled).to.be.false
      expect(video.licence.id).to.equal(4)
    }

    before(async function () {
      await server.config.disableTranscoding()
      await server.config.enableVideoImports()
      await server.config.enableLive({ allowReplay: false, transcoding: false })
    })

    it('Should have the correct server configuration', async function () {
      const config = await server.config.getConfig()

      expect(config.defaults.publish.commentsEnabled).to.be.false
      expect(config.defaults.publish.commentsPolicy).to.equal(VideoCommentPolicy.DISABLED)
      expect(config.defaults.publish.downloadEnabled).to.be.false
      expect(config.defaults.publish.licence).to.equal(4)
      expect(config.defaults.publish.privacy).to.equal(VideoPrivacy.INTERNAL)
    })

    it('Should respect default values when uploading a video', async function () {
      for (const mode of [ 'legacy' as 'legacy', 'resumable' as 'resumable' ]) {
        const { id } = await server.videos.upload({ attributes, mode })

        const video = await server.videos.get({ id })
        checkVideo(video)
      }
    })

    it('Should respect default values when importing a video using URL', async function () {
      const { video: { id } } = await server.videoImports.importVideo({
        attributes: {
          ...attributes,
          channelId,
          targetUrl: FIXTURE_URLS.goodVideo
        }
      })

      const video = await server.videos.get({ id })
      checkVideo(video)
    })

    it('Should respect default values when importing a video using magnet URI', async function () {
      const { video: { id } } = await server.videoImports.importVideo({
        attributes: {
          ...attributes,
          channelId,
          magnetUri: FIXTURE_URLS.magnet
        }
      })

      const video = await server.videos.get({ id })
      checkVideo(video)
    })

    it('Should respect default values when creating a live', async function () {
      const { id } = await server.live.create({
        fields: {
          ...attributes,
          channelId
        }
      })

      const video = await server.videos.get({ id })
      checkVideo(video)
    })
  })

  describe('Default P2P values', function () {

    describe('Webapp default value', function () {

      before(async function () {
        const overrideConfig = {
          defaults: {
            p2p: {
              webapp: {
                enabled: false
              }
            }
          }
        }

        await server.kill()
        await server.run(overrideConfig)
      })

      it('Should have appropriate P2P config', async function () {
        const config = await server.config.getConfig()

        expect(config.defaults.p2p.webapp.enabled).to.be.false
        expect(config.defaults.p2p.embed.enabled).to.be.true
      })

      it('Should create a user with this default setting', async function () {
        await server.users.create({ username: 'user_p2p_1' })
        const userToken = await server.login.getAccessToken('user_p2p_1')

        const { p2pEnabled } = await server.users.getMyInfo({ token: userToken })
        expect(p2pEnabled).to.be.false
      })

      it('Should register a user with this default setting', async function () {
        await server.registrations.register({ username: 'user_p2p_2' })

        const userToken = await server.login.getAccessToken('user_p2p_2')

        const { p2pEnabled } = await server.users.getMyInfo({ token: userToken })
        expect(p2pEnabled).to.be.false
      })
    })

    describe('Embed default value', function () {

      before(async function () {
        const overrideConfig = {
          defaults: {
            p2p: {
              embed: {
                enabled: false
              }
            }
          },
          signup: {
            limit: 15
          }
        }

        await server.kill()
        await server.run(overrideConfig)
      })

      it('Should have appropriate P2P config', async function () {
        const config = await server.config.getConfig()

        expect(config.defaults.p2p.webapp.enabled).to.be.true
        expect(config.defaults.p2p.embed.enabled).to.be.false
      })

      it('Should create a user with this default setting', async function () {
        await server.users.create({ username: 'user_p2p_3' })
        const userToken = await server.login.getAccessToken('user_p2p_3')

        const { p2pEnabled } = await server.users.getMyInfo({ token: userToken })
        expect(p2pEnabled).to.be.true
      })

      it('Should register a user with this default setting', async function () {
        await server.registrations.register({ username: 'user_p2p_4' })

        const userToken = await server.login.getAccessToken('user_p2p_4')

        const { p2pEnabled } = await server.users.getMyInfo({ token: userToken })
        expect(p2pEnabled).to.be.true
      })
    })
  })

  describe('Default player value', function () {

    before(async function () {
      const overrideConfig = {
        defaults: {
          player: {
            auto_play: false
          }
        },
        signup: {
          limit: 15
        }
      }

      await server.kill()
      await server.run(overrideConfig)
    })

    it('Should have appropriate autoplay config', async function () {
      const config = await server.config.getConfig()

      expect(config.defaults.player.autoPlay).to.be.false
    })

    it('Should create a user with this default setting', async function () {
      await server.users.create({ username: 'user_autoplay_1' })
      const userToken = await server.login.getAccessToken('user_autoplay_1')

      const { autoPlayVideo } = await server.users.getMyInfo({ token: userToken })
      expect(autoPlayVideo).to.be.false
    })

    it('Should register a user with this default setting', async function () {
      await server.registrations.register({ username: 'user_autoplay_2' })

      const userToken = await server.login.getAccessToken('user_autoplay_2')

      const { autoPlayVideo } = await server.users.getMyInfo({ token: userToken })
      expect(autoPlayVideo).to.be.false
    })
  })

  describe('Default user attributes', function () {

    it('Should create a user and register a user with the default config', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          user: {
            history: {
              videos: {
                enabled: true
              }
            },
            videoQuota : -1,
            videoQuotaDaily: -1
          },
          signup: {
            enabled: true,
            requiresApproval: false
          }
        }
      })

      const config = await server.config.getConfig()

      expect(config.user.videoQuota).to.equal(-1)
      expect(config.user.videoQuotaDaily).to.equal(-1)

      const user1Token = await server.users.generateUserAndToken('user1')
      const user1 = await server.users.getMyInfo({ token: user1Token })

      const user = { displayName: 'super user 2', username: 'user2', password: 'super password' }
      const channel = { name: 'my_user_2_channel', displayName: 'my channel' }
      await server.registrations.register({ ...user, channel })
      const user2Token = await server.login.getAccessToken(user)
      const user2 = await server.users.getMyInfo({ token: user2Token })

      for (const user of [ user1, user2 ]) {
        expect(user.videosHistoryEnabled).to.be.true
        expect(user.videoQuota).to.equal(-1)
        expect(user.videoQuotaDaily).to.equal(-1)
      }
    })

    it('Should update config and create a user and register a user with the new default config', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          user: {
            history: {
              videos: {
                enabled: false
              }
            },
            videoQuota : 5242881,
            videoQuotaDaily: 318742
          },
          signup: {
            enabled: true,
            requiresApproval: false
          }
        }
      })

      const user3Token = await server.users.generateUserAndToken('user3')
      const user3 = await server.users.getMyInfo({ token: user3Token })

      const user = { displayName: 'super user 4', username: 'user4', password: 'super password' }
      const channel = { name: 'my_user_4_channel', displayName: 'my channel' }
      await server.registrations.register({ ...user, channel })
      const user4Token = await server.login.getAccessToken(user)
      const user4 = await server.users.getMyInfo({ token: user4Token })

      for (const user of [ user3, user4 ]) {
        expect(user.videosHistoryEnabled).to.be.false
        expect(user.videoQuota).to.equal(5242881)
        expect(user.videoQuotaDaily).to.equal(318742)
      }
    })

  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
