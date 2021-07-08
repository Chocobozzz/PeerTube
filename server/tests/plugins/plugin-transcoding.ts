/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { join } from 'path'
import { getAudioStream, getVideoFileFPS, getVideoStreamFromFile } from '@server/helpers/ffprobe-utils'
import {
  buildServerDirectory,
  cleanupTests,
  flushAndRunServer,
  getVideo,
  PluginsCommand,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testFfmpegStreamError,
  uploadVideoAndGetId,
  waitJobs
} from '@shared/extra-utils'
import { VideoDetails, VideoPrivacy } from '@shared/models'

async function createLiveWrapper (server: ServerInfo) {
  const liveAttributes = {
    name: 'live video',
    channelId: server.videoChannel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  const { uuid } = await server.liveCommand.createLive({ fields: liveAttributes })

  return uuid
}

function updateConf (server: ServerInfo, vodProfile: string, liveProfile: string) {
  return server.configCommand.updateCustomSubConfig({
    newConfig: {
      transcoding: {
        enabled: true,
        profile: vodProfile,
        hls: {
          enabled: true
        },
        webtorrent: {
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
  let server: ServerInfo

  before(async function () {
    this.timeout(60000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await updateConf(server, 'default', 'default')
  })

  describe('When using a plugin adding profiles to existing encoders', function () {

    async function checkVideoFPS (uuid: string, type: 'above' | 'below', fps: number) {
      const res = await getVideo(server.url, uuid)
      const video = res.body as VideoDetails
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
      const videoFPS = await getVideoFileFPS(playlistUrl)

      if (type === 'above') {
        expect(videoFPS).to.be.above(fps)
      } else {
        expect(videoFPS).to.be.below(fps)
      }
    }

    before(async function () {
      await server.pluginsCommand.install({ path: PluginsCommand.getPluginTestPath('-transcoding-one') })
    })

    it('Should have the appropriate available profiles', async function () {
      const config = await server.configCommand.getConfig()

      expect(config.transcoding.availableProfiles).to.have.members([ 'default', 'low-vod', 'input-options-vod', 'bad-scale-vod' ])
      expect(config.live.transcoding.availableProfiles).to.have.members([ 'default', 'low-live', 'input-options-live', 'bad-scale-live' ])
    })

    it('Should not use the plugin profile if not chosen by the admin', async function () {
      this.timeout(240000)

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'above', 20)
    })

    it('Should use the vod profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'low-vod', 'default')

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'below', 12)
    })

    it('Should apply input options in vod profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'input-options-vod', 'default')

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'below', 6)
    })

    it('Should apply the scale filter in vod profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'bad-scale-vod', 'default')

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      // Transcoding failed
      const res = await getVideo(server.url, videoUUID)
      const video: VideoDetails = res.body

      expect(video.files).to.have.lengthOf(1)
      expect(video.streamingPlaylists).to.have.lengthOf(0)
    })

    it('Should not use the plugin profile if not chosen by the admin', async function () {
      this.timeout(240000)

      const liveVideoId = await createLiveWrapper(server)

      await server.liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await server.liveCommand.waitUntilLivePublished({ videoId: liveVideoId })
      await waitJobs([ server ])

      await checkLiveFPS(liveVideoId, 'above', 20)
    })

    it('Should use the live profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'low-vod', 'low-live')

      const liveVideoId = await createLiveWrapper(server)

      await server.liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await server.liveCommand.waitUntilLivePublished({ videoId: liveVideoId })
      await waitJobs([ server ])

      await checkLiveFPS(liveVideoId, 'below', 12)
    })

    it('Should apply the input options on live profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'low-vod', 'input-options-live')

      const liveVideoId = await createLiveWrapper(server)

      await server.liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await server.liveCommand.waitUntilLivePublished({ videoId: liveVideoId })
      await waitJobs([ server ])

      await checkLiveFPS(liveVideoId, 'below', 6)
    })

    it('Should apply the scale filter name on live profile', async function () {
      this.timeout(240000)

      await updateConf(server, 'low-vod', 'bad-scale-live')

      const liveVideoId = await createLiveWrapper(server)

      const command = await server.liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await testFfmpegStreamError(command, true)
    })

    it('Should default to the default profile if the specified profile does not exist', async function () {
      this.timeout(240000)

      await server.pluginsCommand.uninstall({ npmName: 'peertube-plugin-test-transcoding-one' })

      const config = await server.configCommand.getConfig()

      expect(config.transcoding.availableProfiles).to.deep.equal([ 'default' ])
      expect(config.live.transcoding.availableProfiles).to.deep.equal([ 'default' ])

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'above', 20)
    })

  })

  describe('When using a plugin adding new encoders', function () {

    before(async function () {
      await server.pluginsCommand.install({ path: PluginsCommand.getPluginTestPath('-transcoding-two') })

      await updateConf(server, 'test-vod-profile', 'test-live-profile')
    })

    it('Should use the new vod encoders', async function () {
      this.timeout(240000)

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video', fixture: 'video_short_240p.mp4' })).uuid
      await waitJobs([ server ])

      const path = buildServerDirectory(server, join('videos', videoUUID + '-240.mp4'))
      const audioProbe = await getAudioStream(path)
      expect(audioProbe.audioStream.codec_name).to.equal('opus')

      const videoProbe = await getVideoStreamFromFile(path)
      expect(videoProbe.codec_name).to.equal('vp9')
    })

    it('Should use the new live encoders', async function () {
      this.timeout(240000)

      const liveVideoId = await createLiveWrapper(server)

      await server.liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId, fixtureName: 'video_short2.webm' })
      await server.liveCommand.waitUntilLivePublished({ videoId: liveVideoId })
      await waitJobs([ server ])

      const playlistUrl = `${server.url}/static/streaming-playlists/hls/${liveVideoId}/0.m3u8`
      const audioProbe = await getAudioStream(playlistUrl)
      expect(audioProbe.audioStream.codec_name).to.equal('opus')

      const videoProbe = await getVideoStreamFromFile(playlistUrl)
      expect(videoProbe.codec_name).to.equal('h264')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
