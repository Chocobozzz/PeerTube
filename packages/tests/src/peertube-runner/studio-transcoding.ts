import { expect } from 'chai'
import { getAllFiles, wait } from '@peertube/peertube-core-utils'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  VideoStudioCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith, checkVideoDuration } from '@tests/shared/checks.js'
import { checkPeerTubeRunnerCacheIsEmpty } from '@tests/shared/directories.js'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'

describe('Test studio transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  function runSuite (options: {
    objectStorage?: ObjectStorageCommand
  } = {}) {
    const { objectStorage } = options

    it('Should run a complex studio transcoding', async function () {
      this.timeout(120000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const oldFileUrls = getAllFiles(video).map(f => f.fileUrl)

      await servers[0].videoStudio.createEditionTasks({ videoId: uuid, tasks: VideoStudioCommand.getComplexTask() })
      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        const files = getAllFiles(video)

        for (const f of files) {
          expect(oldFileUrls).to.not.include(f.fileUrl)
        }

        if (objectStorage) {
          for (const webVideoFile of video.files) {
            expectStartWith(webVideoFile.fileUrl, objectStorage.getMockWebVideosBaseUrl())
          }

          for (const hlsFile of video.streamingPlaylists[0].files) {
            expectStartWith(hlsFile.fileUrl, objectStorage.getMockPlaylistBaseUrl())
          }
        }

        await checkVideoDuration(server, uuid, 9)
      }
    })

    it('Should run a complex task on HLS only video with audio splitted', async function () {
      this.timeout(240_000)

      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true })
      const { uuid } = await servers[0].videos.quickUpload({ name: 'mp4', fixture: 'video_short.mp4' })
      await waitJobs(servers)

      await servers[0].videoStudio.createEditionTasks({ videoId: uuid, tasks: VideoStudioCommand.getComplexTask() })
      await waitJobs(servers, { runnerJobs: true })

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.files).to.have.lengthOf(0)

        await checkVideoDuration(server, uuid, 9)

        await completeCheckHlsPlaylist({
          servers,
          videoUUID: uuid,
          hlsOnly: true,
          splittedAudio: true,
          resolutions: [ 720, 240 ],
          objectStorageBaseUrl: objectStorage?.getMockPlaylistBaseUrl()
        })
      }
    })
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding({ hls: true, webVideo: true })
    await servers[0].config.enableStudio()
    await servers[0].config.enableRemoteStudio()

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  describe('With videos on local filesystem storage', function () {
    runSuite()
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

    runSuite({ objectStorage })

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
