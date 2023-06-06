/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { readFile } from 'fs-extra'
import { checkPersistentTmpIsEmpty, checkVideoDuration } from '@server/tests/shared'
import { buildAbsoluteFixturePath } from '@shared/core-utils'
import {
  RunnerJobStudioTranscodingPayload,
  VideoStudioTranscodingSuccess,
  VideoState,
  VideoStudioTask,
  VideoStudioTaskIntro
} from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  VideoStudioCommand,
  waitJobs
} from '@shared/server-commands'

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

    await servers[0].config.enableTranscoding(true, true)
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

  after(async function () {
    await cleanupTests(servers)
  })
})
