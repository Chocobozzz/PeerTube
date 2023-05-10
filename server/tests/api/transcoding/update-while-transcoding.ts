/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { completeCheckHlsPlaylist } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled, wait } from '@shared/core-utils'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test update video privacy while transcoding', function () {
  let servers: PeerTubeServer[] = []

  const videoUUIDs: string[] = []

  function runTestSuite (hlsOnly: boolean, objectStorageBaseUrl?: string) {

    it('Should not have an error while quickly updating a private video to public after upload #1', async function () {
      this.timeout(360_000)

      const attributes = {
        name: 'quick update',
        privacy: VideoPrivacy.PRIVATE
      }

      const { uuid } = await servers[0].videos.upload({ attributes, waitTorrentGeneration: false })
      await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, objectStorageBaseUrl })
    })

    it('Should not have an error while quickly updating a private video to public after upload #2', async function () {
      this.timeout(60000)

      {
        const attributes = {
          name: 'quick update 2',
          privacy: VideoPrivacy.PRIVATE
        }

        const { uuid } = await servers[0].videos.upload({ attributes, waitTorrentGeneration: true })
        await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
        videoUUIDs.push(uuid)

        await waitJobs(servers)

        await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, objectStorageBaseUrl })
      }
    })

    it('Should not have an error while quickly updating a private video to public after upload #3', async function () {
      this.timeout(60000)

      const attributes = {
        name: 'quick update 3',
        privacy: VideoPrivacy.PRIVATE
      }

      const { uuid } = await servers[0].videos.upload({ attributes, waitTorrentGeneration: true })
      await wait(1000)
      await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, objectStorageBaseUrl })
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
