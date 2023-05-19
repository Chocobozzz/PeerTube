
import { expect } from 'chai'
import { checkPeerTubeRunnerCacheIsEmpty, checkVideoDuration, expectStartWith, PeerTubeRunnerProcess } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled, getAllFiles, wait } from '@shared/core-utils'
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
} from '@shared/server-commands'

describe('Test studio transcoding in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  function runSuite (options: {
    objectStorage: boolean
  }) {
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
          for (const webtorrentFile of video.files) {
            expectStartWith(webtorrentFile.fileUrl, ObjectStorageCommand.getMockWebTorrentBaseUrl())
          }

          for (const hlsFile of video.streamingPlaylists[0].files) {
            expectStartWith(hlsFile.fileUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())
          }
        }

        await checkVideoDuration(server, uuid, 9)
      }
    })
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding(true, true)
    await servers[0].config.enableStudio()
    await servers[0].config.enableRemoteStudio()

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  describe('With videos on local filesystem storage', function () {
    runSuite({ objectStorage: false })
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

    runSuite({ objectStorage: true })
  })

  describe('Check cleanup', function () {

    it('Should have an empty cache directory', async function () {
      await checkPeerTubeRunnerCacheIsEmpty(peertubeRunner)
    })
  })

  after(async function () {
    if (peertubeRunner) {
      await peertubeRunner.unregisterPeerTubeInstance()
      peertubeRunner.kill()
    }

    await cleanupTests(servers)
  })
})
