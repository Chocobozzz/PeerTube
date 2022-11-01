/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { join } from 'path'
import { checkDirectoryIsEmpty, checkTmpIsEmpty, completeCheckHlsPlaylist } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'
import { DEFAULT_AUDIO_RESOLUTION } from '../../../initializers/constants'

describe('Test HLS videos', function () {
  let servers: PeerTubeServer[] = []

  function runTestSuite (hlsOnly: boolean, objectStorageBaseUrl?: string) {
    const videoUUIDs: string[] = []

    it('Should upload a video and transcode it to HLS', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video 1', fixture: 'video_short.webm' } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, objectStorageBaseUrl })
    })

    it('Should upload an audio file and transcode it to HLS', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video audio', fixture: 'sample.ogg' } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({
        servers,
        videoUUID: uuid,
        hlsOnly,
        resolutions: [ DEFAULT_AUDIO_RESOLUTION, 360, 240 ],
        objectStorageBaseUrl
      })
    })

    it('Should update the video', async function () {
      this.timeout(30000)

      await servers[0].videos.update({ id: videoUUIDs[0], attributes: { name: 'video 1 updated' } })

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: videoUUIDs[0], hlsOnly, objectStorageBaseUrl })
    })

    it('Should delete videos', async function () {
      this.timeout(10000)

      for (const uuid of videoUUIDs) {
        await servers[0].videos.remove({ id: uuid })
      }

      await waitJobs(servers)

      for (const server of servers) {
        for (const uuid of videoUUIDs) {
          await server.videos.get({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }
      }
    })

    it('Should have the playlists/segment deleted from the disk', async function () {
      for (const server of servers) {
        await checkDirectoryIsEmpty(server, 'videos', [ 'private' ])
        await checkDirectoryIsEmpty(server, join('videos', 'private'))

        await checkDirectoryIsEmpty(server, join('streaming-playlists', 'hls'), [ 'private' ])
        await checkDirectoryIsEmpty(server, join('streaming-playlists', 'hls', 'private'))
      }
    })

    it('Should have an empty tmp directory', async function () {
      for (const server of servers) {
        await checkTmpIsEmpty(server)
      }
    })
  }

  before(async function () {
    this.timeout(120000)

    const configOverride = {
      transcoding: {
        enabled: true,
        allow_audio_files: true,
        hls: {
          enabled: true
        }
      }
    }
    servers = await createMultipleServers(2, configOverride)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('With WebTorrent & HLS enabled', function () {
    runTestSuite(false)
  })

  describe('With only HLS enabled', function () {

    before(async function () {
      await servers[0].config.updateCustomSubConfig({
        newConfig: {
          transcoding: {
            enabled: true,
            allowAudioFiles: true,
            resolutions: {
              '144p': false,
              '240p': true,
              '360p': true,
              '480p': true,
              '720p': true,
              '1080p': true,
              '1440p': true,
              '2160p': true
            },
            hls: {
              enabled: true
            },
            webtorrent: {
              enabled: false
            }
          }
        }
      })
    })

    runTestSuite(true)
  })

  describe('With object storage enabled', function () {
    if (areMockObjectStorageTestsDisabled()) return

    before(async function () {
      this.timeout(120000)

      const configOverride = ObjectStorageCommand.getDefaultMockConfig()
      await ObjectStorageCommand.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(configOverride)
    })

    runTestSuite(true, ObjectStorageCommand.getMockPlaylistBaseUrl())
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
