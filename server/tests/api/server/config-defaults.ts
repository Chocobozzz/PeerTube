/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FIXTURE_URLS } from '@server/tests/shared'
import { VideoDetails, VideoPrivacy } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers, setDefaultVideoChannel } from '@shared/server-commands'

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
            comments_enabled: false,
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
      commentsEnabled: undefined,
      licence: undefined,
      privacy: VideoPrivacy.PUBLIC // Privacy is mandatory for server
    }

    function checkVideo (video: VideoDetails) {
      expect(video.downloadEnabled).to.be.false
      expect(video.commentsEnabled).to.be.false
      expect(video.licence.id).to.equal(4)
    }

    before(async function () {
      await server.config.disableTranscoding()
      await server.config.enableImports()
      await server.config.enableLive({ allowReplay: false, transcoding: false })
    })

    it('Should have the correct server configuration', async function () {
      const config = await server.config.getConfig()

      expect(config.defaults.publish.commentsEnabled).to.be.false
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
      const { video: { id } } = await server.imports.importVideo({
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
      const { video: { id } } = await server.imports.importVideo({
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
        await server.users.register({ username: 'user_p2p_2' })

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
        await server.users.register({ username: 'user_p2p_4' })

        const userToken = await server.login.getAccessToken('user_p2p_4')

        const { p2pEnabled } = await server.users.getMyInfo({ token: userToken })
        expect(p2pEnabled).to.be.true
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
