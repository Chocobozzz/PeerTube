/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
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
import { expect } from 'chai'

describe('Test VOD transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  function runSpecificSuite (options: {
    webVideoEnabled: boolean
    hlsEnabled: boolean
    splittedAudio?: boolean
    objectStorage?: ObjectStorageCommand
  }) {
    const { webVideoEnabled, hlsEnabled, splittedAudio = false, objectStorage } = options

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
            splittedAudio,
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
            splittedAudio,
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
            splittedAudio,
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
          splittedAudio,
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

      await servers[0].config.enableTranscoding({
        hls: hlsEnabled,
        webVideo: webVideoEnabled,
        splitAudioAndVideo: splittedAudio,
        with0p: true
      })

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
        splittedAudio,
        objectStorageBaseUrl: objectStorageBaseUrlHLS,
        resolutions: [ 720, 480, 360, 240, 144, 0 ]
      })
    })

    it('Should re-transcode a non splitted audio/video HLS only video', async function () {
      this.timeout(240000)

      const resolutions = [ 720, 240 ]

      await servers[0].config.enableTranscoding({
        hls: true,
        webVideo: false,
        resolutions,
        splitAudioAndVideo: false
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'manual hls only transcoding', fixture: 'video_short.mp4' })
      await waitJobs(servers, { runnerJobs: true })

      await servers[0].config.enableTranscoding({
        hls: hlsEnabled,
        webVideo: webVideoEnabled,
        resolutions,
        splitAudioAndVideo: splittedAudio
      })

      await servers[0].videos.runTranscoding({ transcodingType: 'hls', videoId: uuid })
      await waitJobs(servers, { runnerJobs: true })

      await completeCheckHlsPlaylist({
        hlsOnly: true,
        servers: [ servers[0] ],
        videoUUID: uuid,
        splittedAudio,
        objectStorageBaseUrl: objectStorageBaseUrlHLS,
        resolutions
      })
    })
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding({ resolutions: 'max' })
    await servers[0].config.enableRemoteTranscoding()

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  function runSuites (objectStorage?: ObjectStorageCommand) {
    const resolutions = 'max'

    describe('Web video only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ resolutions, webVideo: true, hls: false, with0p: true })
      })

      runSpecificSuite({ webVideoEnabled: true, hlsEnabled: false, objectStorage })
    })

    describe('HLS videos only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ resolutions, webVideo: false, hls: true, with0p: true })
      })

      runSpecificSuite({ webVideoEnabled: false, hlsEnabled: true, objectStorage })
    })

    describe('HLS only with separated audio only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ resolutions, webVideo: false, hls: true, splitAudioAndVideo: true, with0p: true })
      })

      runSpecificSuite({ webVideoEnabled: false, hlsEnabled: true, splittedAudio: true, objectStorage })
    })

    describe('Web video & HLS with separated audio only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ resolutions, hls: true, webVideo: true, splitAudioAndVideo: true, with0p: true })
      })

      runSpecificSuite({ webVideoEnabled: true, hlsEnabled: true, splittedAudio: true, objectStorage })
    })

    describe('Web video & HLS enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding({ resolutions, hls: true, webVideo: true, with0p: true, splitAudioAndVideo: false })
      })

      runSpecificSuite({ webVideoEnabled: true, hlsEnabled: true, objectStorage })
    })
  }

  describe('With videos on local filesystem storage', function () {

    runSuites()

    describe('Common', function () {

      it('Should cap max FPS', async function () {
        this.timeout(120_000)

        await servers[0].config.enableTranscoding({ maxFPS: 15, resolutions: [ 240, 480, 720 ], hls: true, webVideo: true })
        const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
        await waitJobs(servers, { runnerJobs: true })

        const video = await servers[0].videos.get({ id: uuid })
        const hlsFiles = video.streamingPlaylists[0].files

        expect(video.files).to.have.lengthOf(3)
        expect(hlsFiles).to.have.lengthOf(3)

        const fpsArray = getAllFiles(video).map(f => f.fps)

        for (const fps of fpsArray) {
          expect(fps).to.be.at.most(15)
        }
      })

      it('Should not generate an upper resolution than original file', async function () {
        this.timeout(120_000)

        await servers[0].config.enableTranscoding({
          maxFPS: 60,
          resolutions: [ 240, 480 ],
          alwaysTranscodeOriginalResolution: false
        })

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
        await waitJobs(servers, { runnerJobs: true })

        const video = await servers[0].videos.get({ id: uuid })
        const hlsFiles = video.streamingPlaylists[0].files

        expect(video.files).to.have.lengthOf(2)
        expect(hlsFiles).to.have.lengthOf(2)

        const resolutions = getAllFiles(video).map(f => f.resolution.id)
        expect(resolutions).to.have.members([ 240, 240, 480, 480 ])
      })
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

    runSuites(objectStorage)

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  describe('Check cleanup', function () {

    it('Should have an empty cache directory', async function () {
      await checkPeerTubeRunnerCacheIsEmpty(peertubeRunner, 'transcoding')
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
