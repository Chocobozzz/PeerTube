/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { expect } from 'chai'
import { getAllFiles, wait } from '@peertube/peertube-core-utils'
import { VideoPrivacy } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkPeerTubeRunnerCacheIsEmpty } from '@tests/shared/directories.js'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { completeWebVideoFilesCheck } from '@tests/shared/videos.js'

describe('Test VOD transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  function runSuite (options: {
    webVideoEnabled: boolean
    hlsEnabled: boolean
    objectStorage?: ObjectStorageCommand
  }) {
    const { webVideoEnabled, hlsEnabled, objectStorage } = options

    const objectStorageBaseUrlWebVideo = objectStorage
      ? objectStorage.getMockWebVideosBaseUrl()
      : undefined

    const objectStorageBaseUrlHLS = objectStorage
      ? objectStorage.getMockPlaylistBaseUrl()
      : undefined

    it('Should upload a classic video mp4 and transcode it', async function () {
      this.timeout(240000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webVideoEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'video_short.mp4',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebVideo,
            files: [
              { resolution: 0 },
              { resolution: 144 },
              { resolution: 240 },
              { resolution: 360 },
              { resolution: 480 },
              { resolution: 720 }
            ]
          })
        }

        if (hlsEnabled) {
          await completeCheckHlsPlaylist({
            hlsOnly: !webVideoEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 720, 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload a webm video and transcode it', async function () {
      this.timeout(240000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.webm' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webVideoEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'video_short.webm',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebVideo,
            files: [
              { resolution: 0 },
              { resolution: 144 },
              { resolution: 240 },
              { resolution: 360 },
              { resolution: 480 },
              { resolution: 720 }
            ]
          })
        }

        if (hlsEnabled) {
          await completeCheckHlsPlaylist({
            hlsOnly: !webVideoEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 720, 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload an audio only video and transcode it', async function () {
      this.timeout(240000)

      const attributes = { name: 'audio_without_preview', fixture: 'sample.ogg' }
      const { uuid } = await servers[0].videos.upload({ attributes, mode: 'resumable' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webVideoEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'sample.ogg',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebVideo,
            files: [
              { resolution: 0 },
              { resolution: 144 },
              { resolution: 240 },
              { resolution: 360 },
              { resolution: 480 }
            ]
          })
        }

        if (hlsEnabled) {
          await completeCheckHlsPlaylist({
            hlsOnly: !webVideoEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload a private video and transcode it', async function () {
      this.timeout(240000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4', privacy: VideoPrivacy.PRIVATE })

      await waitJobs(servers, { runnerJobs: true })

      if (webVideoEnabled) {
        await completeWebVideoFilesCheck({
          server: servers[0],
          originServer: servers[0],
          fixture: 'video_short.mp4',
          videoUUID: uuid,
          objectStorageBaseUrl: objectStorageBaseUrlWebVideo,
          files: [
            { resolution: 0 },
            { resolution: 144 },
            { resolution: 240 },
            { resolution: 360 },
            { resolution: 480 },
            { resolution: 720 }
          ]
        })
      }

      if (hlsEnabled) {
        await completeCheckHlsPlaylist({
          hlsOnly: !webVideoEnabled,
          servers: [ servers[0] ],
          videoUUID: uuid,
          objectStorageBaseUrl: objectStorageBaseUrlHLS,
          resolutions: [ 720, 480, 360, 240, 144, 0 ]
        })
      }
    })

    it('Should transcode videos on manual run', async function () {
      this.timeout(240000)

      await servers[0].config.disableTranscoding()

      const { uuid } = await servers[0].videos.quickUpload({ name: 'manual transcoding', fixture: 'video_short.mp4' })
      await waitJobs(servers, { runnerJobs: true })

      {
        const video = await servers[0].videos.get({ id: uuid })
        expect(getAllFiles(video)).to.have.lengthOf(1)
      }

      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true })

      await servers[0].videos.runTranscoding({ transcodingType: 'web-video', videoId: uuid })
      await waitJobs(servers, { runnerJobs: true })

      await completeWebVideoFilesCheck({
        server: servers[0],
        originServer: servers[0],
        fixture: 'video_short.mp4',
        videoUUID: uuid,
        objectStorageBaseUrl: objectStorageBaseUrlWebVideo,
        files: [
          { resolution: 0 },
          { resolution: 144 },
          { resolution: 240 },
          { resolution: 360 },
          { resolution: 480 },
          { resolution: 720 }
        ]
      })

      await servers[0].videos.runTranscoding({ transcodingType: 'hls', videoId: uuid })
      await waitJobs(servers, { runnerJobs: true })

      await completeCheckHlsPlaylist({
        hlsOnly: false,
        servers: [ servers[0] ],
        videoUUID: uuid,
        objectStorageBaseUrl: objectStorageBaseUrlHLS,
        resolutions: [ 720, 480, 360, 240, 144, 0 ]
      })
    })

    it('Should not generate an upper resolution than original file', async function () {
      this.timeout(120_000)

      await servers[0].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            enabled: true,
            hls: { enabled: true },
            webVideos: { enabled: true },
            resolutions: {
              '0p': false,
              '144p': false,
              '240p': true,
              '360p': false,
              '480p': true,
              '720p': false,
              '1080p': false,
              '1440p': false,
              '2160p': false
            },
            alwaysTranscodeOriginalResolution: false
          }
        }
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers, { runnerJobs: true })

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(2)
      expect(hlsFiles).to.have.lengthOf(2)

      // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
      const resolutions = getAllFiles(video).map(f => f.resolution.id).sort()
      expect(resolutions).to.deep.equal([ 240, 240, 480, 480 ])
    })
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableRemoteTranscoding()

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  describe('With videos on local filesystem storage', function () {

    describe('Web video only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ webVideo: true, hls: false, with0p: true })
      })

      runSuite({ webVideoEnabled: true, hlsEnabled: false })
    })

    describe('HLS videos only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ webVideo: false, hls: true, with0p: true })
      })

      runSuite({ webVideoEnabled: false, hlsEnabled: true })
    })

    describe('Web video & HLS enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true })
      })

      runSuite({ webVideoEnabled: true, hlsEnabled: true })
    })
  })

  describe('With videos on object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()

      await servers[0].run(objectStorage.getDefaultMockConfig())

      // Wait for peertube runner socket reconnection
      await wait(1500)
    })

    describe('Web video only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ webVideo: true, hls: false, with0p: true })
      })

      runSuite({ webVideoEnabled: true, hlsEnabled: false, objectStorage })
    })

    describe('HLS videos only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ webVideo: false, hls: true, with0p: true })
      })

      runSuite({ webVideoEnabled: false, hlsEnabled: true, objectStorage })
    })

    describe('Web video & HLS enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ hls: true, webVideo: true, with0p: true })
      })

      runSuite({ webVideoEnabled: true, hlsEnabled: true, objectStorage })
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  describe('Check cleanup', function () {

    it('Should have an empty cache directory', async function () {
      await checkPeerTubeRunnerCacheIsEmpty(peertubeRunner)
    })
  })

  after(async function () {
    if (peertubeRunner) {
      await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'runner' })
      peertubeRunner.kill()
    }

    await cleanupTests(servers)
  })
})
