import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  UserNotificationType,
  VideoAIUsage,
  VideoCommercialContent,
  VideoPrivacy,
  VideoState,
  VideoStudioTask
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
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
          try {
            await checkVideoDuration(server, videoUUID, 4)
          } catch {
            // FIXME: workaround for ffmpeg 5.1, to remove on upgrade
            await checkVideoDuration(server, videoUUID, 5)
          }
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
    let subscriberToken: string

    async function getSource () {
      const video = await servers[0].videos.getWithToken({ id: sourceUUID })
      return { ...video, fileIds: getAllFiles(video).map(f => f.id).sort((a, b) => a - b) }
    }

    async function getSubscriptionNotificationsOf (videoUUID: string) {
      const { data } = await servers[0].notifications.list({
        token: subscriberToken,
        typeOneOf: [ UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION ]
      })

      return data.filter(n => n.video.uuid === videoUUID)
    }

    before(async function () {
      this.timeout(120_000)

      await servers[0].config.save()
      await servers[0].config.enableMinimumTranscoding()

      subscriberToken = await servers[0].users.generateUserAndToken('subscriber')
      await servers[0].subscriptions.add({ token: subscriberToken, targetUri: 'root_channel@' + servers[0].host })
    })

    it('Should create a private duplicate and allow changing its privacy while processing', async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })

      await renewVideo()
      sourceUUID = videoUUID

      const chapters = [ { timecode: 0, title: 'Intro' }, { timecode: 2, title: 'Outro' } ]

      await servers[0].videos.update({
        id: sourceUUID,
        attributes: {
          tags: [ 'tag1', 'tag2' ],
          description: 'my description',
          aiUsage: VideoAIUsage.CONTAINS_AI,
          commercialContent: VideoCommercialContent.PAID_PARTNERSHIP,
          support: 'my support',
          nsfw: true,
          downloadEnabled: false
        }
      })
      await servers[0].chapters.update({ videoId: sourceUUID, chapters })
      await servers[0].captions.add({ videoId: sourceUUID, language: 'fr' })
      await waitJobs(servers)

      const sourceBefore = await getSource()

      const sourceOriginal = await servers[0].videos.getSource({ id: sourceUUID })
      expect(sourceOriginal.fileDownloadUrl).to.be.a('string')

      await servers[0].jobs.pauseJobQueue()

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: sourceUUID,
        tasks: [ { name: 'cut', options: { start: 2 } } ],
        saveAsNewVideo: true
      })

      expect(created.uuid).to.not.equal(sourceUUID)

      const newVideo = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(newVideo.state.id).to.equal(VideoState.TO_DUPLICATE)
      expect(newVideo.name).to.equal(sourceBefore.name + ' (Studio Edit)')
      expect(newVideo.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      expect(newVideo.channel.id).to.equal(sourceBefore.channel.id)
      expect(getAllFiles(newVideo)).to.have.lengthOf(0)

      // Metadata and chapters are copied when the duplicate is created
      for (const key of [ 'tags', 'description', 'support', 'nsfw', 'downloadEnabled' ] as const) {
        expect(newVideo[key]).to.deep.equal(sourceBefore[key])
      }

      for (const key of [ 'aiUsage', 'commercialContent', 'category', 'licence', 'language', 'commentsPolicy' ] as const) {
        expect(newVideo[key].id).to.equal(sourceBefore[key].id)
      }

      const { chapters: duplicateChapters } = await servers[0].chapters.list({ videoId: created.uuid })
      expect(duplicateChapters).to.deep.equal(chapters)

      expect(newVideo.thumbnails).to.have.lengthOf(sourceBefore.thumbnails.length)
      for (const thumbnail of newVideo.thumbnails) {
        expect(sourceBefore.thumbnails.map(t => t.fileUrl)).to.not.include(thumbnail.fileUrl)

        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const { data } = await servers[0].videos.listMyVideos({ sort: '-createdAt' })
      expect(data.map(v => v.uuid)).to.include(created.uuid)

      // Source is untouched while the new video is processing
      expect((await getSource()).state.id).to.equal(VideoState.PUBLISHED)

      // Metadata can be reviewed with the regular video update
      await servers[0].videos.update({ id: created.uuid, attributes: { name: 'my clip' } })
      await servers[0].videos.update({
        id: created.uuid,
        attributes: { privacy: VideoPrivacy.PUBLIC }
      })

      const updated = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(updated.privacy.id).to.equal(VideoPrivacy.PUBLIC)
      expect(updated.state.id).to.equal(VideoState.TO_DUPLICATE)

      await servers[0].jobs.resumeJobQueue()
      await waitJobs(servers)

      {
        const edited = await servers[0].videos.getWithToken({ id: created.uuid })

        expect(edited.state.id).to.equal(VideoState.PUBLISHED)
        expect(edited.name).to.equal('my clip')
        expect(edited.privacy.id).to.equal(VideoPrivacy.PUBLIC)
        expect(edited.files.length + edited.streamingPlaylists.length).to.be.above(0)
        expect(edited.thumbnails).to.have.length.above(0)

        expect(edited.duration).to.equal(3)

        // Source video was not modified nor deleted
        const source = await servers[0].videos.get({ id: sourceUUID })
        expect(source.state.id).to.equal(VideoState.PUBLISHED)
        expect(source.name).to.equal(sourceBefore.name)

        await checkVideoDuration(servers[0], sourceUUID, 5)
      }

      {
        const { data: captions } = await servers[0].captions.list({ videoId: created.uuid, token: servers[0].accessToken })
        expect(captions.map(c => c.language.id)).to.deep.equal([ 'fr' ])
        await makeRawRequest({ url: captions[0].fileUrl, token: servers[0].accessToken, expectedStatus: HttpStatusCode.OK_200 })
      }

      // The original file of the source video is not the edited one
      await servers[0].videos.getSource({ id: created.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      // The source keeps its original file
      expect((await servers[0].videos.getSource({ id: sourceUUID })).fileDownloadUrl).to.equal(sourceOriginal.fileDownloadUrl)

      const remote = await servers[1].videos.get({ id: created.uuid })
      expect(remote.privacy.id).to.equal(VideoPrivacy.PUBLIC)
      expect(remote.duration).to.equal(3)

      // Subscribers are notified when it is published
      expect(await getSubscriptionNotificationsOf(created.uuid)).to.have.lengthOf(1)

      const sourceAfter = await getSource()
      expect(sourceAfter.fileIds).to.deep.equal(sourceBefore.fileIds)
      expect(sourceAfter.duration).to.equal(sourceBefore.duration)

      await servers[0].config.enableMinimumTranscoding()
    })

    it('Should notify subscribers when the copy is made public after its edition', async function () {
      this.timeout(120_000)

      await renewVideo()

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: videoUUID,
        tasks: [ { name: 'cut', options: { start: 1 } } ],
        saveAsNewVideo: true
      })
      await waitJobs(servers)

      const copy = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.privacy.id).to.equal(VideoPrivacy.PRIVATE)

      expect(await getSubscriptionNotificationsOf(created.uuid)).to.have.lengthOf(0)

      await servers[0].videos.update({ id: created.uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      await waitJobs(servers)

      expect(await getSubscriptionNotificationsOf(created.uuid)).to.have.lengthOf(1)
    })

    it('Should not duplicate a source video whose files changed since the edition was requested', async function () {
      this.timeout(120_000)

      await renewVideo()
      await servers[0].config.enableFileUpdate()

      await servers[0].jobs.pauseJobQueue()

      let created: { uuid: string }

      try {
        const result = await servers[0].videoStudio.createEditionTasks({
          videoId: videoUUID,
          tasks: [ { name: 'cut', options: { start: 1 } } ],
          saveAsNewVideo: true
        })
        created = result.video

        await servers[0].videos.replaceSourceFile({ videoId: videoUUID, fixture: 'video_short_360p.mp4' })
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)

      const video = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(video.state.id).to.equal(VideoState.TO_DUPLICATE_FAILED)
      expect(getAllFiles(video)).to.have.lengthOf(0)

      await servers[0].videos.remove({ id: created.uuid })
    })

    it('Should not duplicate a video if the user quota is exceeded when the files are copied', async function () {
      this.timeout(120_000)

      const { token, userId } = await servers[0].users.generate('studio_quota_user')

      const { uuid: sourceUUID } = await servers[0].videos.quickUpload({ token, name: 'quota source' })
      await waitJobs(servers)

      const { videoQuotaUsed } = await servers[0].users.getMyQuotaUsed({ token })

      await servers[0].jobs.pauseJobQueue()

      let created: { uuid: string }

      try {
        const result = await servers[0].videoStudio.createEditionTasks({
          token,
          videoId: sourceUUID,
          tasks: [ { name: 'cut', options: { start: 1 } } ],
          saveAsNewVideo: true
        })
        created = result.video

        // The quota was valid when the edition was requested
        await servers[0].users.update({ userId, videoQuota: videoQuotaUsed + 1 })
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)

      const video = await servers[0].videos.getWithToken({ token, id: created.uuid })
      expect(video.state.id).to.equal(VideoState.TO_DUPLICATE_FAILED)
      expect(getAllFiles(video)).to.have.lengthOf(0)

      expect((await servers[0].users.getMyQuotaUsed({ token })).videoQuotaUsed).to.equal(videoQuotaUsed)
      expect((await servers[0].videos.get({ id: sourceUUID })).state.id).to.equal(VideoState.PUBLISHED)
    })

    it('Should retain a failed private placeholder when the source is deleted before duplication', async function () {
      this.timeout(120_000)

      await renewVideo()
      await servers[0].jobs.pauseJobQueue()
      let created: { uuid: string }
      try {
        const result = await servers[0].videoStudio.createEditionTasks({
          videoId: videoUUID,
          tasks: [ { name: 'cut', options: { start: 1 } } ],
          saveAsNewVideo: true
        })
        created = result.video
        await servers[0].videos.remove({ id: videoUUID })
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }
      await waitJobs(servers)
      const video = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(video.state.id).to.equal(VideoState.TO_DUPLICATE_FAILED)
      expect(video.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      expect(getAllFiles(video)).to.have.lengthOf(0)
      await servers[0].videos.remove({ id: created.uuid })
    })

    it('Should save the edition of an HLS only video with splitted audio as a new video', async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true })

      await renewVideo()
      const sourceFileUrls = getAllFiles(await servers[0].videos.get({ id: videoUUID })).map(f => f.fileUrl)

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: videoUUID,
        tasks: [ { name: 'cut', options: { start: 2 } } ],
        saveAsNewVideo: true
      })
      await waitJobs(servers)

      const video = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(video.state.id).to.equal(VideoState.PUBLISHED)
      expect(video.files).to.have.lengthOf(0)
      expect(video.streamingPlaylists).to.have.lengthOf(1)
      expect(video.duration).to.be.approximately(3, 1)

      await checkVideoDuration(servers[0], videoUUID, 5)

      const sourceAfter = await servers[0].videos.get({ id: videoUUID })
      expect(getAllFiles(sourceAfter).map(f => f.fileUrl)).to.deep.equal(sourceFileUrls)
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

    it('Should save the edition of a video in object storage as a new video', async function () {
      this.timeout(240_000)
      await renewVideo()

      const source = await servers[0].videos.get({ id: videoUUID })
      const sourceFileUrls = getAllFiles(source).map(f => f.fileUrl)

      const { video: created } = await servers[0].videoStudio.createEditionTasks({
        videoId: videoUUID,
        tasks: [ { name: 'cut', options: { start: 2 } } ],
        saveAsNewVideo: true
      })
      await waitJobs(servers)

      const video = await servers[0].videos.getWithToken({ id: created.uuid })
      expect(video.state.id).to.equal(VideoState.PUBLISHED)

      for (const file of getAllFiles(video)) {
        expect(sourceFileUrls).to.not.include(file.fileUrl)
      }

      expect(video.duration).to.be.approximately(3, 1)
      await checkVideoDuration(servers[0], videoUUID, 5)

      const sourceAfter = await servers[0].videos.get({ id: videoUUID })
      expect(getAllFiles(sourceAfter).map(f => f.fileUrl)).to.deep.equal(sourceFileUrls)

      for (const url of sourceFileUrls) {
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
      }
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
