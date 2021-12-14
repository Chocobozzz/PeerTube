/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createSingleServer,
  FIXTURE_URLS,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@shared/extra-utils'
import { VideoDetails, VideoPrivacy } from '@shared/models'

const expect = chai.expect

describe('Test config defaults', function () {
  let server: PeerTubeServer
  let channelId: number

  before(async function () {
    this.timeout(30000)

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

    server = await createSingleServer(1, overrideConfig)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    channelId = server.store.channel.id
  })

  describe('Default publish values', function () {
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

  after(async function () {
    await cleanupTests([ server ])
  })
})
