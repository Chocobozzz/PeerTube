/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  RunnerJobTranscriptionPayload,
  TranscriptionSuccess
} from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkPersistentTmpIsEmpty } from '@tests/shared/directories.js'
import { expect } from 'chai'

describe('Test runner transcription', function () {
  let servers: PeerTubeServer[] = []
  let runnerToken: string

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscription({ remote: true })
    runnerToken = await servers[0].runners.autoRegisterRunner()
  })

  async function upload () {
    const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video', language: undefined } })
    await waitJobs(servers)

    const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
    expect(availableJobs).to.have.lengthOf(1)

    const jobUUID = availableJobs[0].uuid

    const { job } = await servers[0].runnerJobs.accept<RunnerJobTranscriptionPayload>({ runnerToken, jobUUID })
    return { uuid, job }
  }

  it('Should execute a remote transcription job', async function () {
    this.timeout(240_000)

    const { uuid, job } = await upload()

    expect(job.type === 'video-transcription')
    expect(job.payload.input.videoFileUrl).to.exist

    // Check video input file
    {
      await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken: job.jobToken, runnerToken })
    }

    const payload: TranscriptionSuccess = {
      inputLanguage: 'ar',
      vttFile: 'subtitle-good1.vtt'
    }

    await servers[0].runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken: job.jobToken, payload })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      expect(video.language.id).to.equal('ar')

      const captions = await server.captions.list({ videoId: uuid })
      expect(captions)
    }

    await checkPersistentTmpIsEmpty(servers[0])
  })

  it('Should not assign caption/language with an unknown inputLanguage', async function () {
    this.timeout(240_000)

    const { uuid, job } = await upload()

    const payload: TranscriptionSuccess = {
      inputLanguage: 'toto',
      vttFile: 'subtitle-good1.vtt'
    }

    await servers[0].runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken: job.jobToken, payload })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      expect(video.language.id).to.be.null

      const { total, data } = await server.captions.list({ videoId: uuid })
      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    }
  })

  it('Should error a transcription job and decrease the job count', async function () {
    this.timeout(60000)

    const { job, uuid } = await upload()
    await servers[0].runnerJobs.error({ runnerToken, jobUUID: job.uuid, jobToken: job.jobToken, message: 'Error' })

    for (let i = 0; i < 4; i++) {
      const { job: { jobToken } } = await servers[0].runnerJobs.accept({ runnerToken, jobUUID: job.uuid })

      await servers[0].runnerJobs.error({ runnerToken, jobUUID: job.uuid, jobToken, message: 'Error' })
    }

    await waitJobs(servers)

    await servers[0].captions.runGenerate({ videoId: uuid })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
