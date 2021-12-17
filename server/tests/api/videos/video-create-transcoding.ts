/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { expectStartWith } from '@server/tests/shared'
import { areObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoDetails } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  expectNoFailedTranscodingJob,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

const expect = chai.expect

async function checkFilesInObjectStorage (video: VideoDetails) {
  for (const file of video.files) {
    expectStartWith(file.fileUrl, ObjectStorageCommand.getWebTorrentBaseUrl())
    await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
  }

  for (const file of video.streamingPlaylists[0].files) {
    expectStartWith(file.fileUrl, ObjectStorageCommand.getPlaylistBaseUrl())
    await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
  }
}

function runTests (objectStorage: boolean) {
  let servers: PeerTubeServer[] = []
  let videoUUID: string
  let publishedAt: string

  before(async function () {
    this.timeout(120000)

    const config = objectStorage
      ? ObjectStorageCommand.getDefaultConfig()
      : {}

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2, config)
    await setAccessTokensToServers(servers)

    await servers[0].config.disableTranscoding()

    await doubleFollow(servers[0], servers[1])

    if (objectStorage) await ObjectStorageCommand.prepareDefaultBuckets()

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

    await servers[0].videos.removeWebTorrentFiles({ videoId: videoUUID })
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
    if (areObjectStorageTestsDisabled()) return

    runTests(true)
  })
})
