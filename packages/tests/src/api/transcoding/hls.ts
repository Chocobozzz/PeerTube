/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { DEFAULT_AUDIO_RESOLUTION } from '@peertube/peertube-server/core/initializers/constants.js'
import { checkDirectoryIsEmpty, checkTmpIsEmpty } from '@tests/shared/directories.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { join } from 'path'

describe('Test HLS videos', function () {
  let servers: PeerTubeServer[] = []

  function runTestSuite (options: {
    hlsOnly: boolean
    concurrency: number
    objectStorageBaseUrl?: string
  }) {
    const { hlsOnly, objectStorageBaseUrl, concurrency } = options

    const videoUUIDs: string[] = []

    before(async function () {
      await servers[0].config.enableTranscoding({
        resolutions: [ 720, 480, 360, 240 ],
        hls: true,
        webVideo: !hlsOnly
      })

      await servers[0].config.setTranscodingConcurrency(concurrency)
    })

    it('Should upload a video and transcode it to HLS', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video 1', fixture: 'video_short.webm' } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, objectStorageBaseUrl })
    })

    it('Should upload a video without audio', async function () {
      this.timeout(120_000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'no audio', fixture: 'video_short_no_audio.mp4' } })
      videoUUIDs.push(uuid)

      await waitJobs(servers)

      await completeCheckHlsPlaylist({ servers, videoUUID: uuid, hlsOnly, hasAudio: false, objectStorageBaseUrl })
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
        await checkDirectoryIsEmpty(server, 'web-videos', [ 'private' ])
        await checkDirectoryIsEmpty(server, join('web-videos', 'private'))

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

  for (const concurrency of [ 1, 2 ]) {
    describe(`With concurrency ${concurrency}`, function () {

      describe('With Web Video & HLS enabled', function () {
        runTestSuite({ hlsOnly: false, concurrency })
      })

      describe('With only HLS enabled', function () {
        runTestSuite({ hlsOnly: true, concurrency })
      })
    })
  }

  describe('With object storage enabled', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(120000)

      const configOverride = objectStorage.getDefaultMockConfig()
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(configOverride)
    })

    for (const concurrency of [ 1, 2 ]) {
      describe(`With concurrency ${concurrency}`, function () {
        runTestSuite({ hlsOnly: true, concurrency, objectStorageBaseUrl: objectStorage.getMockPlaylistBaseUrl() })
      })
    }

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
