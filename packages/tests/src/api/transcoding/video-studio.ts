import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy, VideoState, VideoStudioTask } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  VideoStudioCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkVideoDuration, expectStartWith } from '@tests/shared/checks.js'
import { checkPersistentTmpIsEmpty } from '@tests/shared/directories.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'

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

  function runCommonTests () {
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

        await servers[0].config.save()
        await servers[0].config.enableMinimumTranscoding({ splitAudioAndVideo: true })
        await renewVideo('video_short1.webm')

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

        await servers[0].config.rollback()
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

      it('Should add an outro without audio to a video without audio', async function () {
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

    describe('Removing segments', function () {
      it('Should remove a single segment from the middle of the video', async function () {
        this.timeout(120_000)
        await renewVideo('video_short1.webm') // 10 seconds

        await createTasks([
          {
            name: 'remove-segments',
            options: {
              segments: [ { start: 2, end: 6 } ] // removes 4s → 6s remaining
            }
          }
        ])

        for (const server of servers) {
          await checkVideoDuration(server, videoUUID, 6)
        }
      })

      it('Should remove multiple segments from the video', async function () {
        this.timeout(120_000)
        await renewVideo('video_short1.webm') // 10 seconds

        await createTasks([
          {
            name: 'remove-segments',
            options: {
              segments: [
                { start: 1, end: 3 }, // removes 2s
                { start: 6, end: 8 } // removes 2s → 6s remaining
              ]
            }
          }
        ])

        for (const server of servers) {
          await checkVideoDuration(server, videoUUID, 6)
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
  }

  describe('Web videos enabled', function () {
    it('Should run a complex task', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, VideoStudioCommand.getComplexTaskVideoDuration())
      }
    })
  })

  describe('Editing with a profile that adds no video filter', function () {
    before(async function () {
      this.timeout(60_000)

      await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-transcoding-one') })

      await servers[0].config.save()
      await servers[0].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            profile: 'low-vod'
          }
        }
      })
    })

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

    it('Should remove a segment', async function () {
      this.timeout(120_000)
      await renewVideo('video_short1.webm') // 10 seconds

      await createTasks([
        {
          name: 'remove-segments',
          options: {
            segments: [ { start: 2, end: 6 } ]
          }
        }
      ])

      for (const server of servers) {
        await checkVideoDuration(server, videoUUID, 6)
      }
    })

    it('Should add a watermark', async function () {
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

    after(async function () {
      await servers[0].config.rollback()
      await servers[0].plugins.uninstall({ npmName: 'peertube-plugin-test-transcoding-one' })
    })
  })

  describe('HLS only studio edition', function () {
    before(async function () {
      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true })
    })

    runCommonTests()

    it('Should run a complex task', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(0)

        await checkVideoDuration(server, videoUUID, VideoStudioCommand.getComplexTaskVideoDuration())

        await completeCheckHlsPlaylist({ servers, videoUUID, hlsOnly: true, resolutions: [ 720, 240 ] })
      }
    })
  })

  describe('HLS with splitted audio studio edition', function () {
    before(async function () {
      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true })
    })

    runCommonTests()

    it('Should run a complex task', async function () {
      this.timeout(240_000)
      await renewVideo()

      await createTasks(VideoStudioCommand.getComplexTask())

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(0)

        await checkVideoDuration(server, videoUUID, VideoStudioCommand.getComplexTaskVideoDuration())

        await completeCheckHlsPlaylist({ servers, videoUUID, hlsOnly: true, splittedAudio: true, resolutions: [ 720, 240 ] })
      }
    })
  })

  describe('Save as new video', function () {
    let sourceUUID: string

    async function getSource () {
      const video = await servers[0].videos.getWithToken({ id: sourceUUID })
      return { ...video, fileIds: getAllFiles(video).map(f => f.id).sort((a, b) => a - b) }
    }

    before(async function () {
      this.timeout(120_000)

      await servers[0].config.save()
      await servers[0].config.enableMinimumTranscoding()
    })

    it('Should keep editing the original video by default', async function () {
      this.timeout(120_000)

      await renewVideo()
      const { total } = await servers[0].videos.listMyVideos()

      await createTasks([ { name: 'cut', options: { start: 2 } } ])

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.state.id).to.equal(VideoState.PUBLISHED)
      expect(video.duration).to.be.approximately(3, 1)

      const after = await servers[0].videos.listMyVideos()
      expect(after.total).to.equal(total)
    })

    it('Should create a new video in its own edition state that can be edited while processing', async function () {
      this.timeout(120_000)

      await renewVideo()
      sourceUUID = videoUUID

      const sourceBefore = await getSource()

      await servers[0].jobs.pauseJobQueue()

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: sourceUUID,
        tasks: [ { name: 'cut', options: { start: 2 } } ],
        saveAsNewVideo: true
      })

      expect(created.uuid).to.not.equal(sourceUUID)

      // Visible in the library with the processing state, using the source title as default and a safe privacy
      const newVideo = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(newVideo.state.id).to.equal(VideoState.TO_EDIT_AS_NEW_VIDEO)
      expect(newVideo.name).to.equal(sourceBefore.name)
      expect(newVideo.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      expect(newVideo.channel.id).to.equal(sourceBefore.channel.id)

      const { data } = await servers[0].videos.listMyVideos({ sort: '-createdAt' })
      expect(data.map(v => v.uuid)).to.include(created.uuid)

      // Source is untouched while the new video is processing
      expect((await getSource()).state.id).to.equal(VideoState.PUBLISHED)

      // Metadata can be reviewed with the regular video update
      await servers[0].videos.update({ id: created.uuid, attributes: { name: 'my clip', privacy: VideoPrivacy.PUBLIC } })

      await servers[0].jobs.resumeJobQueue()
      await waitJobs(servers)

      for (const server of servers) {
        const edited = await server.videos.get({ id: created.uuid })

        expect(edited.state.id).to.equal(VideoState.PUBLISHED)
        expect(edited.name).to.equal('my clip')
        expect(edited.privacy.id).to.equal(VideoPrivacy.PUBLIC)
        expect(edited.files.length + edited.streamingPlaylists.length).to.be.above(0)
        expect(edited.thumbnails).to.have.length.above(0)

        await checkVideoDuration(server, created.uuid, 3)

        // Source video was not modified nor deleted
        const source = await server.videos.get({ id: sourceUUID })
        expect(source.state.id).to.equal(VideoState.PUBLISHED)
        expect(source.name).to.equal(sourceBefore.name)

        await checkVideoDuration(server, sourceUUID, 5)
      }

      const sourceAfter = await getSource()
      expect(sourceAfter.fileIds).to.deep.equal(sourceBefore.fileIds)
      expect(sourceAfter.duration).to.equal(sourceBefore.duration)
    })

    it('Should remove the new video if the source video is deleted before the job runs', async function () {
      this.timeout(120_000)

      await renewVideo()
      sourceUUID = videoUUID

      await servers[0].jobs.pauseJobQueue()

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: sourceUUID,
        tasks: [ { name: 'cut', options: { start: 2 } } ],
        saveAsNewVideo: true
      })

      await servers[0].videos.remove({ id: sourceUUID })

      await servers[0].jobs.resumeJobQueue()
      await waitJobs(servers)

      await servers[0].videos.getWithToken({ id: created.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      const { data } = await servers[0].videos.listMyVideos()
      expect(data.map(v => v.uuid)).to.not.include(created.uuid)

      await checkPersistentTmpIsEmpty(servers[0])
    })

    after(async function () {
      await servers[0].config.rollback()
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
        await checkVideoDuration(server, videoUUID, VideoStudioCommand.getComplexTaskVideoDuration())
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

        await checkVideoDuration(server, videoUUID, VideoStudioCommand.getComplexTaskVideoDuration())
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
