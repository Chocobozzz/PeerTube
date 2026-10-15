/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { readFile } from 'fs/promises'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  RunnerJobStudioTranscodingPayload,
  VideoStudioTranscodingSuccess,
  VideoState,
  VideoPrivacy,
  VideoStudioTask,
  VideoStudioTaskIntro
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  VideoStudioCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkVideoDuration } from '@tests/shared/checks.js'
import { checkPersistentTmpIsEmpty } from '@tests/shared/directories.js'

describe('Test runner video studio transcoding', function () {
  let servers: PeerTubeServer[] = []
  let runnerToken: string
  let videoUUID: string
  let jobUUID: string

  async function renewStudio (tasks: VideoStudioTask[] = VideoStudioCommand.getComplexTask()) {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    await waitJobs(servers)

    await servers[0].videoStudio.createEditionTasks({ videoId: uuid, tasks })
    await waitJobs(servers)

    const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
    expect(availableJobs).to.have.lengthOf(1)

    jobUUID = availableJobs[0].uuid
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

    runnerToken = await servers[0].runners.autoRegisterRunner()
  })

  it('Should error a studio transcoding job', async function () {
    this.timeout(60000)

    await renewStudio()

    for (let i = 0; i < 5; i++) {
      const { job } = await servers[0].runnerJobs.accept({ runnerToken, jobUUID })
      const jobToken = job.jobToken

      await servers[0].runnerJobs.error({ runnerToken, jobUUID, jobToken, message: 'Error' })
    }

    const video = await servers[0].videos.get({ id: videoUUID })
    expect(video.state.id).to.equal(VideoState.PUBLISHED)

    await checkPersistentTmpIsEmpty(servers[0])
  })

  it('Should cancel a transcoding job', async function () {
    this.timeout(60000)

    await renewStudio()

    await servers[0].runnerJobs.cancelByAdmin({ jobUUID })

    const video = await servers[0].videos.get({ id: videoUUID })
    expect(video.state.id).to.equal(VideoState.PUBLISHED)

    await checkPersistentTmpIsEmpty(servers[0])
  })

  it('Should execute a remote studio job', async function () {
    this.timeout(240_000)

    const tasks = [
      {
        name: 'add-outro' as 'add-outro',
        options: {
          file: 'video_short.webm'
        }
      },
      {
        name: 'add-watermark' as 'add-watermark',
        options: {
          file: 'custom-thumbnail.png'
        }
      },
      {
        name: 'add-intro' as 'add-intro',
        options: {
          file: 'video_very_short_240p.mp4'
        }
      }
    ]

    await renewStudio(tasks)

    for (const server of servers) {
      await checkVideoDuration(server, videoUUID, 5)
    }

    const { job } = await servers[0].runnerJobs.accept<RunnerJobStudioTranscodingPayload>({ runnerToken, jobUUID })
    const jobToken = job.jobToken

    expect(job.type === 'video-studio-transcoding')
    expect(job.payload.input.videoFileUrl).to.exist

    // Check video input file
    {
      await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
    }

    // Check task files
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const payloadTask = job.payload.tasks[i]

      expect(payloadTask.name).to.equal(task.name)

      const inputFile = await readFile(buildAbsoluteFixturePath(task.options.file))

      const { body } = await servers[0].runnerJobs.getJobFile({
        url: (payloadTask as VideoStudioTaskIntro).options.file as string,
        jobToken,
        runnerToken
      })

      expect(body).to.deep.equal(inputFile)
    }

    const payload: VideoStudioTranscodingSuccess = { videoFile: 'video_very_short_240p.mp4' }
    await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

    await waitJobs(servers)

    for (const server of servers) {
      await checkVideoDuration(server, videoUUID, 2)
    }

    await checkPersistentTmpIsEmpty(servers[0])
  })

  it('Should keep a failed private duplicate for an in-place studio retry', async function () {
    this.timeout(240_000)

    const source = await servers[0].videos.quickUpload({ name: 'source', fixture: 'video_short.webm' })
    await waitJobs(servers)
    await servers[0].videos.update({ id: source.uuid, attributes: { thumbnailfile: 'custom-thumbnail.png' } })
    const { video: created } = await servers[0].videoStudio.createEditionTasks({
      videoId: source.uuid,
      tasks: [ { name: 'cut', options: { start: 1 } } ],
      saveAsNewVideo: true
    })
    await waitJobs(servers)

    const copied = await servers[0].videos.getWithToken({ id: created.uuid })
    expect(copied.state.id).to.equal(VideoState.TO_EDIT_AS_NEW_VIDEO)
    expect(copied.privacy.id).to.equal(VideoPrivacy.PRIVATE)
    expect(copied.thumbnails).to.have.length.above(0)
    const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
    expect(availableJobs).to.have.lengthOf(1)
    await servers[0].runnerJobs.cancelByAdmin({ jobUUID: availableJobs[0].uuid })

    const failed = await servers[0].videos.getWithToken({ id: created.uuid })
    expect(failed.state.id).to.equal(VideoState.TO_EDIT_FAILED)
    expect(failed.thumbnails).to.deep.equal(copied.thumbnails)
    expect(failed.files).to.have.length.above(0)

    await servers[0].videoStudio.createEditionTasks({
      videoId: created.uuid,
      tasks: [ { name: 'cut', options: { start: 1 } } ]
    })
    const retryJobs = await servers[0].runnerJobs.request({ runnerToken })
    expect(retryJobs.availableJobs).to.have.lengthOf(1)
    const retryUUID = retryJobs.availableJobs[0].uuid
    const { job } = await servers[0].runnerJobs.accept({ runnerToken, jobUUID: retryUUID })
    await servers[0].runnerJobs.success({
      runnerToken,
      jobUUID: retryUUID,
      jobToken: job.jobToken,
      payload: { videoFile: 'video_very_short_240p.mp4' }
    })
    await waitJobs(servers)

    const edited = await servers[0].videos.getWithToken({ id: created.uuid })
    expect(edited.state.id).to.equal(VideoState.PUBLISHED)
    expect(edited.privacy.id).to.equal(VideoPrivacy.PRIVATE)
    expect(edited.uuid).to.equal(created.uuid)
    expect(edited.duration).to.equal(2)
    expect(edited.thumbnails).to.not.deep.equal(copied.thumbnails)
    expect((await servers[0].videos.get({ id: source.uuid })).duration).to.equal(5)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
