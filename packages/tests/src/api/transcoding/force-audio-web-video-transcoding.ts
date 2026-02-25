/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  cleanupTests,
  ConfigCommand,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test force audio web video transcoding', function () {
  let servers: PeerTubeServer[] = []
  let videoId1: string
  let videoId2: string

  before(async function () {
    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1' })
      videoId1 = uuid
    }

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 2' })
      videoId2 = uuid
    }

    await servers[0].config.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          originalFile: {
            keep: false
          },

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: ConfigCommand.getCustomConfigResolutions([ 240, 720, 1080 ]),

          alwaysTranscodeOriginalResolution: true,
          alwaysTranscodePodcastOptimizedAudio: true,

          webVideos: {
            enabled: false
          },

          hls: {
            enabled: true,
            splitAudioAndVideo: false
          }
        }
      }
    })
  })

  it('Should enable some web video resolutions and override global configuration for audio resolution', async function () {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })

      expect(video.files.map(f => f.resolution.id)).to.have.members([ 0 ])
      expect(video.streamingPlaylists[0].files.map(f => f.resolution.id)).to.have.members([ 240, 720 ])
    }
  })

  it('Should force the audio resolution on manual web video transcoding', async function () {
    {
      const video = await servers[0].videos.get({ id: videoId1 })
      expect(video.files.map(f => f.resolution.id)).to.have.members([ 720 ])
      expect(video.streamingPlaylists).to.have.lengthOf(0)
    }

    await servers[0].videos.runTranscoding({ transcodingType: 'web-video', videoId: videoId1 })
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoId1 })
      expect(video.files.map(f => f.resolution.id)).to.have.members([ 0, 240, 720 ])
      expect(video.streamingPlaylists).to.have.lengthOf(0)
    }
  })

  it('Should not force the audio resolution on manual hls transcoding', async function () {
    {
      const video = await servers[0].videos.get({ id: videoId2 })
      expect(video.files.map(f => f.resolution.id)).to.have.members([ 720 ])
      expect(video.streamingPlaylists).to.have.lengthOf(0)
    }

    await servers[0].videos.runTranscoding({ transcodingType: 'hls', videoId: videoId2 })
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoId2 })
      expect(video.files.map(f => f.resolution.id)).to.have.members([ 720 ])
      expect(video.streamingPlaylists[0].files.map(f => f.resolution.id)).to.have.members([ 240, 720 ])
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
