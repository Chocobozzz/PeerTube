/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { checkResolutionsInMasterPlaylist, expectStartWith } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoDetails } from '@shared/models'
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
} from '@shared/server-commands'

async function checkFilesInObjectStorage (video: VideoDetails) {
  for (const file of video.files) {
    expectStartWith(file.fileUrl, ObjectStorageCommand.getMockWebTorrentBaseUrl())
    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  if (video.streamingPlaylists.length === 0) return

  const hlsPlaylist = video.streamingPlaylists[0]
  for (const file of hlsPlaylist.files) {
    expectStartWith(file.fileUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())
    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  expectStartWith(hlsPlaylist.playlistUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())
  await makeRawRequest({ url: hlsPlaylist.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

  expectStartWith(hlsPlaylist.segmentsSha256Url, ObjectStorageCommand.getMockPlaylistBaseUrl())
  await makeRawRequest({ url: hlsPlaylist.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
}

function runTests (objectStorage: boolean) {
  let servers: PeerTubeServer[] = []
  let videoUUID: string
  let publishedAt: string

  let shouldBeDeleted: string[]

  before(async function () {
    this.timeout(120000)

    const config = objectStorage
      ? ObjectStorageCommand.getDefaultMockConfig()
      : {}

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2, config)
    await setAccessTokensToServers(servers)

    await servers[0].config.disableTranscoding()

    await doubleFollow(servers[0], servers[1])

    if (objectStorage) await ObjectStorageCommand.prepareDefaultMockBuckets()

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

      if (objectStorage) await checkFilesInObjectStorage(videoDetails)
    }
  })

  it('Should generate WebTorrent', async function () {
    this.timeout(60000)

    await servers[0].videos.runTranscoding({
      videoId: videoUUID,
      transcodingType: 'webtorrent'
    })

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (objectStorage) await checkFilesInObjectStorage(videoDetails)
    }
  })

  it('Should generate WebTorrent from HLS only video', async function () {
    this.timeout(60000)

    await servers[0].videos.removeAllWebTorrentFiles({ videoId: videoUUID })
    await waitJobs(servers)

    await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'webtorrent' })
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(5)

      if (objectStorage) await checkFilesInObjectStorage(videoDetails)
    }
  })

  it('Should only generate WebTorrent', async function () {
    this.timeout(60000)

    await servers[0].videos.removeHLSPlaylist({ videoId: videoUUID })
    await waitJobs(servers)

    await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'webtorrent' })
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.files).to.have.lengthOf(5)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(0)

      if (objectStorage) await checkFilesInObjectStorage(videoDetails)
    }
  })

  it('Should correctly update HLS playlist on resolution change', async function () {
    this.timeout(120000)

    await servers[0].config.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          resolutions: ConfigCommand.getCustomConfigResolutions(false),

          webtorrent: {
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

      if (objectStorage) await checkFilesInObjectStorage(videoDetails)

      shouldBeDeleted = [
        videoDetails.streamingPlaylists[0].files[0].fileUrl,
        videoDetails.streamingPlaylists[0].playlistUrl,
        videoDetails.streamingPlaylists[0].segmentsSha256Url
      ]
    }

    await servers[0].config.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          resolutions: ConfigCommand.getCustomConfigResolutions(true),

          webtorrent: {
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

      if (objectStorage) {
        await checkFilesInObjectStorage(videoDetails)

        const hlsPlaylist = videoDetails.streamingPlaylists[0]
        const resolutions = hlsPlaylist.files.map(f => f.resolution.id)
        await checkResolutionsInMasterPlaylist({ server: servers[0], playlistUrl: hlsPlaylist.playlistUrl, resolutions })

        const shaBody = await servers[0].streamingPlaylists.getSegmentSha256({ url: hlsPlaylist.segmentsSha256Url })
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
