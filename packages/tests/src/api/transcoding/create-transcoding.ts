/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import { HttpStatusCode, VideoDetails } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createMultipleServers,
  doubleFollow,
  expectNoFailedTranscodingJob,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkResolutionsInMasterPlaylist } from '@tests/shared/streaming-playlists.js'

async function checkFilesInObjectStorage (objectStorage: ObjectStorageCommand, video: VideoDetails) {
  for (const file of video.files) {
    expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  if (video.streamingPlaylists.length === 0) return

  const hlsPlaylist = video.streamingPlaylists[0]
  for (const file of hlsPlaylist.files) {
    expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())
    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  expectStartWith(hlsPlaylist.playlistUrl, objectStorage.getMockPlaylistBaseUrl())
  await makeRawRequest({ url: hlsPlaylist.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

  expectStartWith(hlsPlaylist.segmentsSha256Url, objectStorage.getMockPlaylistBaseUrl())
  await makeRawRequest({ url: hlsPlaylist.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
}

function runTests (enableObjectStorage: boolean) {
  let servers: PeerTubeServer[] = []
  let videoUUID: string
  let publishedAt: string

  let shouldBeDeleted: string[]
  const objectStorage = new ObjectStorageCommand()

  before(async function () {
    this.timeout(120000)

    const config = enableObjectStorage
      ? objectStorage.getDefaultMockConfig()
      : {}

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2, config)
    await setAccessTokensToServers(servers)

    await servers[0].config.disableTranscoding()

    await doubleFollow(servers[0], servers[1])

    if (enableObjectStorage) await objectStorage.prepareDefaultMockBuckets()

    const { shortUUID } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = shortUUID

    await waitJobs(servers)

    const video = await servers[0].videos.get({ id: videoUUID })
    publishedAt = video.publishedAt as string

    await servers[0].config.enableTranscoding()
  })

  it('Should generate HLS', async function () {
    this.timeout(60000)

    await servers[0].videos.runTranscoding({
      videoId: videoUUID,
      transcodingType: 'hls'
    })

    await waitJobs(servers)
    await expectNoFailedTranscodingJob(servers[0])

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)
    }
  })

  it('Should generate Web Video', async function () {
    this.timeout(60000)

    await servers[0].videos.runTranscoding({
      videoId: videoUUID,
      transcodingType: 'web-video'
    })

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)
    }
  })

  it('Should generate Web Video from HLS only video', async function () {
    this.timeout(60000)

    await servers[0].videos.removeAllWebVideoFiles({ videoId: videoUUID })
    await waitJobs(servers)

    await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'web-video' })
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)
    }
  })

  it('Should only generate Web Video', async function () {
    this.timeout(60000)

    await servers[0].videos.removeHLSPlaylist({ videoId: videoUUID })
    await waitJobs(servers)

    await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'web-video' })
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(0)

      if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)
    }
  })

  it('Should correctly update HLS playlist on resolution change', async function () {
    this.timeout(120000)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          resolutions: ConfigCommand.getCustomConfigResolutions(false),

          webVideos: {
            enabled: true
          },
          hls: {
            enabled: true
          }
        }
      }
    })

    const { uuid } = await servers[0].videos.quickUpload({ name: 'quick' })

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: uuid })

      expect(videoDetails.files).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(1)

      if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)

      shouldBeDeleted = [
        videoDetails.streamingPlaylists[0].files[0].fileUrl,
        videoDetails.streamingPlaylists[0].playlistUrl,
        videoDetails.streamingPlaylists[0].segmentsSha256Url
      ]
    }

    await servers[0].config.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          resolutions: ConfigCommand.getCustomConfigResolutions(true),

          webVideos: {
            enabled: true
          },
          hls: {
            enabled: true
          }
        }
      }
    })

    await servers[0].videos.runTranscoding({ videoId: uuid, transcodingType: 'hls' })
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: uuid })

      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (enableObjectStorage) {
        await checkFilesInObjectStorage(objectStorage, videoDetails)

        const hlsPlaylist = videoDetails.streamingPlaylists[0]
        const resolutions = hlsPlaylist.files.map(f => f.resolution.id)
        await checkResolutionsInMasterPlaylist({ server: servers[0], playlistUrl: hlsPlaylist.playlistUrl, resolutions })

        const shaBody = await servers[0].streamingPlaylists.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url, withRetry: true })
        expect(Object.keys(shaBody)).to.have.lengthOf(5)
      }
    }
  })

  it('Should have correctly deleted previous files', async function () {
    for (const fileUrl of shouldBeDeleted) {
      await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }
  })

  it('Should not have updated published at attributes', async function () {
    const video = await servers[0].videos.get({ id: videoUUID })

    expect(video.publishedAt).to.equal(publishedAt)
  })

  after(async function () {
    if (objectStorage) await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
}

describe('Test create transcoding jobs from API', function () {

  describe('On filesystem', function () {
    runTests(false)
  })

  describe('On object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runTests(true)
  })
})
