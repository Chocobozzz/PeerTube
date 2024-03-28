/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { getAudioStream, getVideoStream, getVideoStreamFPS } from '@peertube/peertube-ffmpeg'
import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testFfmpegStreamError,
  waitJobs
} from '@peertube/peertube-server-commands'

async function createLiveWrapper (server: PeerTubeServer) {
  const liveAttributes = {
    name: 'live video',
    channelId: server.store.channel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  const { uuid } = await server.live.create({ fields: liveAttributes })

  return uuid
}

function updateConf (server: PeerTubeServer, vodProfile: string, liveProfile: string) {
  return server.config.updateExistingConfig({
    newConfig: {
      transcoding: {
        enabled: true,
        profile: vodProfile,
        hls: {
          enabled: true
        },
        webVideos: {
          enabled: true
        },
        resolutions: {
          '240p': true,
          '360p': false,
          '480p': false,
          '720p': true
        }
      },
      live: {
        enabled: true,
        maxInstanceLives: -1,
        maxUserLives: -1,
        transcoding: {
          profile: liveProfile,
          enabled: true,
          resolutions: {
            '240p': true,
            '360p': false,
            '480p': false,
            '720p': true
          }
        }
      }
    }
  })
}

describe('Test transcoding plugins', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await updateConf(server, 'default', 'default')
  })

  describe('When using a plugin adding profiles to existing encoders', function () {

    async function checkVideoFPS (uuid: string, type: 'above' | 'below', fps: number) {
      const video = await server.videos.get({ id: uuid })
      const files = video.files.concat(...video.streamingPlaylists.map(p => p.files))

      for (const file of files) {
        if (type === 'above') {
          expect(file.fps).to.be.above(fps)
        } else {
          expect(file.fps).to.be.below(fps)
        }
      }
    }

    async function checkLiveFPS (uuid: string, type: 'above' | 'below', fps: number) {
      const playlistUrl = `${server.url}/static/streaming-playlists/hls/${uuid}/0.m3u8`
      const videoFPS = await getVideoStreamFPS(playlistUrl)

      if (type === 'above') {
        expect(videoFPS).to.be.above(fps)
      } else {
        expect(videoFPS).to.be.below(fps)
      }
    }

    before(async function () {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-transcoding-one') })
    })

    it('Should have the appropriate available profiles', async function () {
      const config = await server.config.getConfig()

      expect(config.transcoding.availableProfiles).to.have.members([ 'default', 'low-vod', 'input-options-vod', 'bad-scale-vod' ])
      expect(config.live.transcoding.availableProfiles).to.have.members([ 'default', 'high-live', 'input-options-live', 'bad-scale-live' ])
    })

    describe('VOD', function () {

      it('Should not use the plugin profile if not chosen by the admin', async function () {
        this.timeout(240000)

        const videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
        await waitJobs([ server ])

        await checkVideoFPS(videoUUID, 'above', 20)
      })

      it('Should use the vod profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'low-vod', 'default')

        const videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
        await waitJobs([ server ])

        await checkVideoFPS(videoUUID, 'below', 12)
      })

      it('Should apply input options in vod profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'input-options-vod', 'default')

        const videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
        await waitJobs([ server ])

        await checkVideoFPS(videoUUID, 'below', 6)
      })

      it('Should apply the scale filter in vod profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'bad-scale-vod', 'default')

        const videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
        await waitJobs([ server ])

        // Transcoding failed
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(1)
        expect(video.streamingPlaylists).to.have.lengthOf(0)
      })
    })

    describe('Live', function () {

      it('Should not use the plugin profile if not chosen by the admin', async function () {
        this.timeout(240000)

        const liveVideoId = await createLiveWrapper(server)

        await server.live.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_very_short_240p.mp4' })
        await server.live.waitUntilPublished({ videoId: liveVideoId })
        await waitJobs([ server ])

        await checkLiveFPS(liveVideoId, 'above', 20)
      })

      it('Should use the live profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'low-vod', 'high-live')

        const liveVideoId = await createLiveWrapper(server)

        await server.live.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_very_short_240p.mp4' })
        await server.live.waitUntilPublished({ videoId: liveVideoId })
        await waitJobs([ server ])

        await checkLiveFPS(liveVideoId, 'above', 45)
      })

      it('Should apply the input options on live profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'low-vod', 'input-options-live')

        const liveVideoId = await createLiveWrapper(server)

        await server.live.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_very_short_240p.mp4' })
        await server.live.waitUntilPublished({ videoId: liveVideoId })
        await waitJobs([ server ])

        await checkLiveFPS(liveVideoId, 'above', 45)
      })

      it('Should apply the scale filter name on live profile', async function () {
        this.timeout(240000)

        await updateConf(server, 'low-vod', 'bad-scale-live')

        const liveVideoId = await createLiveWrapper(server)

        const command = await server.live.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_very_short_240p.mp4' })
        await testFfmpegStreamError(command, true)
      })

      it('Should default to the default profile if the specified profile does not exist', async function () {
        this.timeout(240000)

        await server.plugins.uninstall({ npmName: 'peertube-plugin-test-transcoding-one' })

        const config = await server.config.getConfig()

        expect(config.transcoding.availableProfiles).to.deep.equal([ 'default' ])
        expect(config.live.transcoding.availableProfiles).to.deep.equal([ 'default' ])

        const videoUUID = (await server.videos.quickUpload({ name: 'video', fixture: 'video_very_short_240p.mp4' })).uuid
        await waitJobs([ server ])

        await checkVideoFPS(videoUUID, 'above', 20)
      })
    })

  })

  describe('When using a plugin adding new encoders', function () {

    before(async function () {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-transcoding-two') })

      await updateConf(server, 'test-vod-profile', 'test-live-profile')
    })

    it('Should use the new vod encoders', async function () {
      this.timeout(240000)

      const videoUUID = (await server.videos.quickUpload({ name: 'video', fixture: 'video_very_short_240p.mp4' })).uuid
      await waitJobs([ server ])

      const video = await server.videos.get({ id: videoUUID })

      const path = server.servers.buildWebVideoFilePath(video.files[0].fileUrl)
      const audioProbe = await getAudioStream(path)
      expect(audioProbe.audioStream.codec_name).to.equal('opus')

      const videoProbe = await getVideoStream(path)
      expect(videoProbe.codec_name).to.equal('vp9')
    })

    it('Should use the new live encoders', async function () {
      this.timeout(240000)

      const liveVideoId = await createLiveWrapper(server)

      await server.live.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await server.live.waitUntilPublished({ videoId: liveVideoId })
      await waitJobs([ server ])

      const playlistUrl = `${server.url}/static/streaming-playlists/hls/${liveVideoId}/0.m3u8`
      const audioProbe = await getAudioStream(playlistUrl)
      expect(audioProbe.audioStream.codec_name).to.equal('opus')

      const videoProbe = await getVideoStream(playlistUrl)
      expect(videoProbe.codec_name).to.equal('h264')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
