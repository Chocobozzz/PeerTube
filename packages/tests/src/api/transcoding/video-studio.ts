import { expect } from 'chai'
import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import { VideoStudioTask } from '@peertube/peertube-models'
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
import { checkVideoDuration, expectStartWith } from '@tests/shared/checks.js'
import { checkPersistentTmpIsEmpty } from '@tests/shared/directories.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'

describe('Test video studio', function () {
  let servers: PeerTubeServer[] = []
  let videoUUID: string

  async function renewVideo (fixture = 'video_short.webm') {
    const video = await servers[0].videos.quickUpload({ name: 'video', fixture })
    videoUUID = video.uuid

    await waitJobs(servers)
  }

  async function createTasks (tasks: VideoStudioTask[]) {
    await servers[0].videoStudio.createEditionTasks({ videoId: videoUUID, tasks })
    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableMinimumTranscoding()

    await servers[0].config.enableStudio()
  })

  describe('Cutting', function () {

    it('Should cut the beginning of the video', async function () {
      this.timeout(120_000)

      await renewVideo()
      await waitJobs(servers)

      const beforeTasks = new Date()

      await createTasks([
        {
          name: 'cut',
          options: {
            start: 2
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 3)

        const video = await server.videos.get({ id: videoUUID })
        expect(new Date(video.publishedAt)).to.be.below(beforeTasks)
      }
    })

    it('Should cut the end of the video', async function () {
      this.timeout(120_000)
      await renewVideo()

      await createTasks([
        {
          name: 'cut',
          options: {
            end: 2
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 2)
      }
    })

    it('Should cut start/end of the video', async function () {
      this.timeout(120_000)
      await renewVideo('video_short1.webm') // 10 seconds video duration

      await createTasks([
        {
          name: 'cut',
          options: {
            start: 2,
            end: 6
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 4)
      }
    })

    it('Should cut start/end of the audio', async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding({ splitAudioAndVideo: true })
      await renewVideo('video_short1.webm')
      await servers[0].config.enableMinimumTranscoding()

      const video = await servers[0].videos.get({ id: videoUUID })
      for (const file of video.files) {
        if (file.resolution.id === 0) continue

        await servers[0].videos.removeWebVideoFile({ fileId: file.id, videoId: videoUUID })
      }

      for (const file of getHLS(video).files) {
        if (file.resolution.id === 0) continue

        await servers[0].videos.removeHLSFile({ fileId: file.id, videoId: videoUUID })
      }

      await createTasks([
        {
          name: 'cut',
          options: {
            start: 2,
            end: 6
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 4)
      }
    })
  })

  describe('Intro/Outro', function () {

    it('Should add an intro', async function () {
      this.timeout(120_000)
      await renewVideo()

      await createTasks([
        {
          name: 'add-intro',
          options: {
            file: 'video_short.webm'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 10)
      }
    })

    it('Should add an outro', async function () {
      this.timeout(120_000)
      await renewVideo()

      await createTasks([
        {
          name: 'add-outro',
          options: {
            file: 'video_very_short_240p.mp4'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 7)
      }
    })

    it('Should add an intro/outro', async function () {
      this.timeout(120_000)
      await renewVideo()

      await createTasks([
        {
          name: 'add-intro',
          options: {
            file: 'video_very_short_240p.mp4'
          }
        },
        {
          name: 'add-outro',
          options: {
            // Different frame rate
            file: 'video_short2.webm'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 12)
      }
    })

    it('Should add an intro to a video without audio', async function () {
      this.timeout(120_000)
      await renewVideo('video_short_no_audio.mp4')

      await createTasks([
        {
          name: 'add-intro',
          options: {
            file: 'video_very_short_240p.mp4'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 7)
      }
    })

    it('Should add an outro without audio to a video with audio', async function () {
      this.timeout(120_000)
      await renewVideo()

      await createTasks([
        {
          name: 'add-outro',
          options: {
            file: 'video_short_no_audio.mp4'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 10)
      }
    })

    it('Should add an outro without audio to a video with audio', async function () {
      this.timeout(120_000)
      await renewVideo('video_short_no_audio.mp4')

      await createTasks([
        {
          name: 'add-outro',
          options: {
            file: 'video_short_no_audio.mp4'
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 10)
      }
    })
  })

  describe('Watermark', function () {

    it('Should add a watermark to the video', async function () {
      this.timeout(120_000)
      await renewVideo()

      const video = await servers[0].videos.get({ id: videoUUID })
      const oldFileUrls = getAllFiles(video).map(f => f.fileUrl)

      await createTasks([
        {
          name: 'add-watermark',
          options: {
            file: 'custom-thumbnail.png'
          }
        }
      ])

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        const fileUrls = getAllFiles(video).map(f => f.fileUrl)

        for (const oldUrl of oldFileUrls) {
          expect(fileUrls).to.not.include(oldUrl)
        }
      }
    })
  })

  describe('Complex tasks', function () {

    it('Should run a complex task', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 9)
      }
    })
  })

  describe('HLS only studio edition', function () {

    before(async function () {
      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true })
    })

    it('Should run a complex task on HLS only video', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(0)

        await checkVideoDuration(server, videoUUID, 9)

        await completeCheckHlsPlaylist({ servers, videoUUID, hlsOnly: true, resolutions: [ 720, 240 ] })
      }
    })
  })

  describe('HLS with splitted audio studio edition', function () {

    before(async function () {
      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true })
    })

    it('Should run a complex task on HLS only video', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(0)

        await checkVideoDuration(server, videoUUID, 9)

        await completeCheckHlsPlaylist({ servers, videoUUID, hlsOnly: true, splittedAudio: true, resolutions: [ 720, 240 ] })
      }
    })
  })

  describe('Server restart', function () {

    it('Should still be able to run video edition after a server restart', async function () {
      this.timeout(240_000)

      await renewVideo()
      await servers[0].videoStudio.createEditionTasks({ videoId: videoUUID, tasks: VideoStudioCommand.getComplexTask() })

      await servers[0].kill()
      await servers[0].run()

      await waitJobs(servers)

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 9)
      }
    })

    it('Should have an empty persistent tmp directory', async function () {
      await checkPersistentTmpIsEmpty(servers[0])
    })
  })

  describe('Object storage studio edition', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig())

      await servers[0].config.enableMinimumTranscoding()
    })

    it('Should run a complex task on a video in object storage', async function () {
      this.timeout(240_000)
      await renewVideo()

      const video = await servers[0].videos.get({ id: videoUUID })
      const oldFileUrls = getAllFiles(video).map(f => f.fileUrl)

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        const files = getAllFiles(video)

        for (const f of files) {
          expect(oldFileUrls).to.not.include(f.fileUrl)
        }

        for (const webVideoFile of video.files) {
          expectStartWith(webVideoFile.fileUrl, objectStorage.getMockWebVideosBaseUrl())
        }

        for (const hlsFile of video.streamingPlaylists[0].files) {
          expectStartWith(hlsFile.fileUrl, objectStorage.getMockPlaylistBaseUrl())
        }

        await checkVideoDuration(server, videoUUID, 9)
      }
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
