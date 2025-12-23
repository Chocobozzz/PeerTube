/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoDetails, VideoResolution } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
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
import { checkResolutionsInMasterPlaylist, completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'

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

function runTests (options: {
  concurrency: number
  enableObjectStorage: boolean
}) {
  const { concurrency, enableObjectStorage } = options

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

    await servers[0].config.enableTranscoding({ webVideo: true, hls: true, resolutions: 'max' })
    await servers[0].config.setTranscodingConcurrency(concurrency)
  })

  describe('Common transcoding', function () {

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
            resolutions: ConfigCommand.getConfigResolutions(false),

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
            resolutions: ConfigCommand.getConfigResolutions(true),

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

    it('Should transcode with an audio-only video', async function () {
      this.timeout(60000)

      await servers[0].config.enableTranscoding({
        webVideo: true,
        hls: false,
        keepOriginal: false,
        splitAudioAndVideo: false,
        alwaysTranscodeOriginalResolution: false,
        resolutions: [ VideoResolution.H_NOVIDEO ]
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'quick' })
      await waitJobs(servers)

      // Only keep audio resolution
      {
        const video = await servers[0].videos.get({ id: uuid })

        expect(video.streamingPlaylists).to.have.lengthOf(0)

        for (const file of video.files) {
          if (file.resolution.id !== VideoResolution.H_NOVIDEO) {
            await servers[0].videos.removeWebVideoFile({ videoId: uuid, fileId: file.id })
          }
        }
      }

      await servers[0].videos.runTranscoding({ videoId: uuid, transcodingType: 'hls' })
      await waitJobs(servers)

      await servers[0].videos.runTranscoding({ videoId: uuid, transcodingType: 'web-video' })
      await waitJobs(servers)
      await expectNoFailedTranscodingJob(servers[0])

      for (const server of servers) {
        const videoDetails = await server.videos.get({ id: uuid })

        expect(videoDetails.files).to.have.lengthOf(1)
        expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
        expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(1)

        for (const files of videoDetails.files) {
          expect(files.resolution.id).to.equal(VideoResolution.H_NOVIDEO)
        }

        if (enableObjectStorage) await checkFilesInObjectStorage(objectStorage, videoDetails)
      }
    })
  })

  describe('With split audio and video', function () {

    async function runTest (options: {
      audio: boolean
      hls: boolean
      webVideo: boolean
      afterWebVideo: boolean
      resolutions?: number[]
    }) {
      let resolutions = options.resolutions

      if (!resolutions) {
        resolutions = [ 720, 240 ]

        if (options.audio) resolutions.push(0)
      }

      const objectStorageBaseUrl = enableObjectStorage
        ? objectStorage?.getMockPlaylistBaseUrl()
        : undefined

      await servers[0].config.enableTranscoding({
        resolutions,
        hls: options.hls,
        splitAudioAndVideo: false,
        webVideo: options.webVideo
      })

      const { uuid: videoUUID } = await servers[0].videos.quickUpload({ name: 'hls splitted' })
      await waitJobs(servers)
      await completeCheckHlsPlaylist({
        servers,
        resolutions,
        videoUUID,
        hlsOnly: !options.webVideo,
        splittedAudio: false,
        objectStorageBaseUrl
      })

      await servers[0].config.enableTranscoding({
        resolutions,
        hls: true,
        splitAudioAndVideo: true,
        webVideo: options.afterWebVideo
      })

      await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'hls' })
      await waitJobs(servers)

      if (options.afterWebVideo) {
        await servers[0].videos.runTranscoding({ videoId: videoUUID, transcodingType: 'web-video' })
        await waitJobs(servers)
      }

      await completeCheckHlsPlaylist({
        servers,
        resolutions,
        videoUUID,
        hlsOnly: !options.afterWebVideo,
        splittedAudio: true,
        objectStorageBaseUrl
      })
    }

    it('Should split audio and video from an existing Web & HLS video', async function () {
      this.timeout(60000)

      await runTest({ webVideo: true, hls: true, afterWebVideo: true, audio: false })
    })

    it('Should split audio and video from an existing HLS video without audio resolution', async function () {
      this.timeout(60000)

      await runTest({ webVideo: false, hls: true, afterWebVideo: true, audio: false })
    })

    it('Should split audio and video to a HLS only video from an existing HLS video without audio resolution', async function () {
      this.timeout(60000)

      await runTest({ webVideo: false, hls: true, afterWebVideo: false, audio: false })
    })

    it('Should split audio and video to a HLS only video from an existing HLS video with audio resolution', async function () {
      this.timeout(60000)

      await runTest({ webVideo: false, hls: true, afterWebVideo: false, audio: false })
    })

    it('Should split audio and video on HLS only video that only have 1 resolution', async function () {
      this.timeout(60000)

      await runTest({ webVideo: false, hls: true, afterWebVideo: false, audio: false, resolutions: [ 720 ] })
    })
  })

  after(async function () {
    if (objectStorage) await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
}

describe('Test create transcoding jobs from API', function () {

  for (const concurrency of [ 1, 2 ]) {
    describe('With concurrency ' + concurrency, function () {

      describe('On filesystem', function () {
        runTests({ concurrency, enableObjectStorage: false })
      })

      describe('On object storage', function () {
        if (areMockObjectStorageTestsDisabled()) return

        runTests({ concurrency, enableObjectStorage: true })
      })
    })
  }
})
