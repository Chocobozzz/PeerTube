/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { expect } from 'chai'
import {
  checkPeerTubeRunnerCacheIsEmpty,
  completeCheckHlsPlaylist,
  completeWebVideoFilesCheck,
  PeerTubeRunnerProcess
} from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled, getAllFiles, wait } from '@shared/core-utils'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Test VOD transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  function runSuite (options: {
    webtorrentEnabled: boolean
    hlsEnabled: boolean
    objectStorage: boolean
  }) {
    const { webtorrentEnabled, hlsEnabled, objectStorage } = options

    const objectStorageBaseUrlWebTorrent = objectStorage
      ? ObjectStorageCommand.getMockWebTorrentBaseUrl()
      : undefined

    const objectStorageBaseUrlHLS = objectStorage
      ? ObjectStorageCommand.getMockPlaylistBaseUrl()
      : undefined

    it('Should upload a classic video mp4 and transcode it', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webtorrentEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'video_short.mp4',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebTorrent,
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
            hlsOnly: !webtorrentEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 720, 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload a webm video and transcode it', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.webm' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webtorrentEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'video_short.webm',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebTorrent,
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
            hlsOnly: !webtorrentEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 720, 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload an audio only video and transcode it', async function () {
      this.timeout(120000)

      const attributes = { name: 'audio_without_preview', fixture: 'sample.ogg' }
      const { uuid } = await servers[0].videos.upload({ attributes, mode: 'resumable' })

      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        if (webtorrentEnabled) {
          await completeWebVideoFilesCheck({
            server,
            originServer: servers[0],
            fixture: 'sample.ogg',
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlWebTorrent,
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
            hlsOnly: !webtorrentEnabled,
            servers,
            videoUUID: uuid,
            objectStorageBaseUrl: objectStorageBaseUrlHLS,
            resolutions: [ 480, 360, 240, 144, 0 ]
          })
        }
      }
    })

    it('Should upload a private video and transcode it', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4', privacy: VideoPrivacy.PRIVATE })

      await waitJobs(servers, { runnerJobs: true })

      if (webtorrentEnabled) {
        await completeWebVideoFilesCheck({
          server: servers[0],
          originServer: servers[0],
          fixture: 'video_short.mp4',
          videoUUID: uuid,
          objectStorageBaseUrl: objectStorageBaseUrlWebTorrent,
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
          hlsOnly: !webtorrentEnabled,
          servers: [ servers[0] ],
          videoUUID: uuid,
          objectStorageBaseUrl: objectStorageBaseUrlHLS,
          resolutions: [ 720, 480, 360, 240, 144, 0 ]
        })
      }
    })

    it('Should transcode videos on manual run', async function () {
      this.timeout(120000)

      await servers[0].config.disableTranscoding()

      const { uuid } = await servers[0].videos.quickUpload({ name: 'manual transcoding', fixture: 'video_short.mp4' })
      await waitJobs(servers, { runnerJobs: true })

      {
        const video = await servers[0].videos.get({ id: uuid })
        expect(getAllFiles(video)).to.have.lengthOf(1)
      }

      await servers[0].config.enableTranscoding(true, true, true)

      await servers[0].videos.runTranscoding({ transcodingType: 'webtorrent', videoId: uuid })
      await waitJobs(servers, { runnerJobs: true })

      await completeWebVideoFilesCheck({
        server: servers[0],
        originServer: servers[0],
        fixture: 'video_short.mp4',
        videoUUID: uuid,
        objectStorageBaseUrl: objectStorageBaseUrlWebTorrent,
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
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableRemoteTranscoding()

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess()
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ server: servers[0], registrationToken, runnerName: 'runner' })
  })

  describe('With videos on local filesystem storage', function () {

    describe('Web video only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(true, false, true)
      })

      runSuite({ webtorrentEnabled: true, hlsEnabled: false, objectStorage: false })
    })

    describe('HLS videos only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(false, true, true)
      })

      runSuite({ webtorrentEnabled: false, hlsEnabled: true, objectStorage: false })
    })

    describe('Web video & HLS enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(true, true, true)
      })

      runSuite({ webtorrentEnabled: true, hlsEnabled: true, objectStorage: false })
    })
  })

  describe('With videos on object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    before(async function () {
      await ObjectStorageCommand.prepareDefaultMockBuckets()

      await servers[0].kill()

      await servers[0].run(ObjectStorageCommand.getDefaultMockConfig())

      // Wait for peertube runner socket reconnection
      await wait(1500)
    })

    describe('Web video only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(true, false, true)
      })

      runSuite({ webtorrentEnabled: true, hlsEnabled: false, objectStorage: true })
    })

    describe('HLS videos only enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(false, true, true)
      })

      runSuite({ webtorrentEnabled: false, hlsEnabled: true, objectStorage: true })
    })

    describe('Web video & HLS enabled', function () {

      before(async function () {
        await servers[0].config.enableTranscoding(true, true, true)
      })

      runSuite({ webtorrentEnabled: true, hlsEnabled: true, objectStorage: true })
    })
  })

  describe('Check cleanup', function () {

    it('Should have an empty cache directory', async function () {
      await checkPeerTubeRunnerCacheIsEmpty()
    })
  })

  after(async function () {
    if (peertubeRunner) {
      await peertubeRunner.unregisterPeerTubeInstance({ server: servers[0] })
      peertubeRunner.kill()
    }

    await cleanupTests(servers)
  })
})
