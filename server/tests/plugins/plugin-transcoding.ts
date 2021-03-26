/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { join } from 'path'
import { getAudioStream, getVideoFileFPS, getVideoStreamFromFile } from '@server/helpers/ffprobe-utils'
import { ServerConfig, VideoDetails, VideoPrivacy } from '@shared/models'
import {
  buildServerDirectory,
  createLive,
  getConfig,
  getPluginTestPath,
  getVideo,
  installPlugin,
  sendRTMPStreamInVideo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  uninstallPlugin,
  updateCustomSubConfig,
  uploadVideoAndGetId,
  waitJobs,
  waitUntilLivePublished
} from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../shared/extra-utils/server/servers'

async function createLiveWrapper (server: ServerInfo) {
  const liveAttributes = {
    name: 'live video',
    channelId: server.videoChannel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  const res = await createLive(server.url, server.accessToken, liveAttributes)
  return res.body.video.uuid
}

function updateConf (server: ServerInfo, vodProfile: string, liveProfile: string) {
  return updateCustomSubConfig(server.url, server.accessToken, {
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
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        path: getPluginTestPath('-transcoding-one')
      })
    })

    it('Should have the appropriate available profiles', async function () {
      const res = await getConfig(server.url)
      const config = res.body as ServerConfig

      expect(config.transcoding.availableProfiles).to.have.members([ 'default', 'low-vod' ])
      expect(config.live.transcoding.availableProfiles).to.have.members([ 'default', 'low-live' ])
    })

    it('Should not use the plugin profile if not chosen by the admin', async function () {
      this.timeout(120000)

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'above', 20)
    })

    it('Should use the vod profile', async function () {
      this.timeout(120000)

      await updateConf(server, 'low-vod', 'default')

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'below', 12)
    })

    it('Should not use the plugin profile if not chosen by the admin', async function () {
      this.timeout(120000)

      const liveVideoId = await createLiveWrapper(server)

      await sendRTMPStreamInVideo(server.url, server.accessToken, liveVideoId, 'video_short2.webm')
      await waitUntilLivePublished(server.url, server.accessToken, liveVideoId)
      await waitJobs([ server ])

      await checkLiveFPS(liveVideoId, 'above', 20)
    })

    it('Should use the live profile', async function () {
      this.timeout(120000)

      await updateConf(server, 'low-vod', 'low-live')

      const liveVideoId = await createLiveWrapper(server)

      await sendRTMPStreamInVideo(server.url, server.accessToken, liveVideoId, 'video_short2.webm')
      await waitUntilLivePublished(server.url, server.accessToken, liveVideoId)
      await waitJobs([ server ])

      await checkLiveFPS(liveVideoId, 'below', 12)
    })

    it('Should default to the default profile if the specified profile does not exist', async function () {
      this.timeout(120000)

      await uninstallPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-plugin-test-transcoding-one' })

      const res = await getConfig(server.url)
      const config = res.body as ServerConfig

      expect(config.transcoding.availableProfiles).to.deep.equal([ 'default' ])
      expect(config.live.transcoding.availableProfiles).to.deep.equal([ 'default' ])

      const videoUUID = (await uploadVideoAndGetId({ server, videoName: 'video' })).uuid
      await waitJobs([ server ])

      await checkVideoFPS(videoUUID, 'above', 20)
    })

  })

  describe('When using a plugin adding new encoders', function () {

    before(async function () {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        path: getPluginTestPath('-transcoding-two')
      })

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
      this.timeout(120000)

      const liveVideoId = await createLiveWrapper(server)

      await sendRTMPStreamInVideo(server.url, server.accessToken, liveVideoId, 'video_short2.webm')
      await waitUntilLivePublished(server.url, server.accessToken, liveVideoId)
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
