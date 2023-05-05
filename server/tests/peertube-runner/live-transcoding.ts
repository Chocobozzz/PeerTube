import { expect } from 'chai'
/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import {
  checkPeerTubeRunnerCacheIsEmpty,
  expectStartWith,
  PeerTubeRunnerProcess,
  SQLCommand,
  testLiveVideoResolutions
} from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled, wait } from '@shared/core-utils'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  findExternalSavedVideo,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@shared/server-commands'

describe('Test Live transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess
  let sqlCommandServer1: SQLCommand

  function runSuite (options: {
    objectStorage: boolean
  }) {
    const { objectStorage } = options

    it('Should enable transcoding without additional resolutions', async function () {
      this.timeout(120000)

      const { video } = await servers[0].live.quickCreate({ permanentLive: true, saveReplay: false, privacy: VideoPrivacy.PUBLIC })

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: video.uuid })
      await waitUntilLivePublishedOnAllServers(servers, video.uuid)
      await waitJobs(servers)

      await testLiveVideoResolutions({
        originServer: servers[0],
        sqlCommand: sqlCommandServer1,
        servers,
        liveVideoId: video.uuid,
        resolutions: [ 720, 480, 360, 240, 144 ],
        objectStorage,
        transcoded: true
      })

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveWaitingOnAllServers(servers, video.uuid)
      await servers[0].videos.remove({ id: video.id })
    })

    it('Should transcode audio only RTMP stream', async function () {
      this.timeout(120000)

      const { video } = await servers[0].live.quickCreate({ permanentLive: true, saveReplay: false, privacy: VideoPrivacy.UNLISTED })

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: video.uuid, fixtureName: 'video_short_no_audio.mp4' })
      await waitUntilLivePublishedOnAllServers(servers, video.uuid)
      await waitJobs(servers)

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveWaitingOnAllServers(servers, video.uuid)
      await servers[0].videos.remove({ id: video.id })
    })

    it('Should save a replay', async function () {
      this.timeout(120000)

      const { video } = await servers[0].live.quickCreate({ permanentLive: true, saveReplay: true })

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: video.uuid })
      await waitUntilLivePublishedOnAllServers(servers, video.uuid)

      await testLiveVideoResolutions({
        originServer: servers[0],
        sqlCommand: sqlCommandServer1,
        servers,
        liveVideoId: video.uuid,
        resolutions: [ 720, 480, 360, 240, 144 ],
        objectStorage,
        transcoded: true
      })

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveWaitingOnAllServers(servers, video.uuid)
      await waitJobs(servers)

      const session = await servers[0].live.findLatestSession({ videoId: video.uuid })
      expect(session.endingProcessed).to.be.true
      expect(session.endDate).to.exist
      expect(session.saveReplay).to.be.true

      const videoLiveDetails = await servers[0].videos.get({ id: video.uuid })
      const replay = await findExternalSavedVideo(servers[0], videoLiveDetails)

      for (const server of servers) {
        const video = await server.videos.get({ id: replay.uuid })

        expect(video.files).to.have.lengthOf(0)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const files = video.streamingPlaylists[0].files
        expect(files).to.have.lengthOf(5)

        for (const file of files) {
          if (objectStorage) {
            expectStartWith(file.fileUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())
          }

          await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    })
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    sqlCommandServer1 = new SQLCommand(servers[0])

    await servers[0].config.enableRemoteTranscoding()
    await servers[0].config.enableTranscoding(true, true, true)
    await servers[0].config.enableLive({ allowReplay: true, resolutions: 'max', transcoding: true })

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess()
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ server: servers[0], registrationToken, runnerName: 'runner' })
  })

  describe('With lives on local filesystem storage', function () {

    before(async function () {
      await servers[0].config.enableTranscoding(true, false, true)
    })

    runSuite({ objectStorage: false })
  })

  describe('With lives on object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    before(async function () {
      await ObjectStorageCommand.prepareDefaultMockBuckets()

      await servers[0].kill()

      await servers[0].run(ObjectStorageCommand.getDefaultMockConfig())

      // Wait for peertube runner socket reconnection
      await wait(1500)
    })

    runSuite({ objectStorage: true })
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
