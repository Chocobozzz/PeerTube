/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  Runner,
  RunnerJob,
  RunnerJobAdmin,
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobVODWebVideoTranscodingPayload,
  RunnerRegistrationToken
} from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test runner common actions', function () {
  let server: PeerTubeServer
  let registrationToken: string
  let runnerToken: string
  let jobMaxPriority: string

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1, {
      remote_runners: {
        stalled_jobs: {
          vod: '5 seconds'
        }
      }
    })

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'max' })
    await server.config.enableRemoteTranscoding()
  })

  describe('Managing runner registration tokens', function () {
    let base: RunnerRegistrationToken[]
    let registrationTokenToDelete: RunnerRegistrationToken

    it('Should have a default registration token', async function () {
      const { total, data } = await server.runnerRegistrationTokens.list()

      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const token = data[0]
      expect(token.id).to.exist
      expect(token.createdAt).to.exist
      expect(token.updatedAt).to.exist
      expect(token.registeredRunnersCount).to.equal(0)
      expect(token.registrationToken).to.exist
    })

    it('Should create other registration tokens', async function () {
      await server.runnerRegistrationTokens.generate()
      await server.runnerRegistrationTokens.generate()

      const { total, data } = await server.runnerRegistrationTokens.list()
      expect(total).to.equal(3)
      expect(data).to.have.lengthOf(3)
    })

    it('Should list registration tokens', async function () {
      {
        const { total, data } = await server.runnerRegistrationTokens.list({ sort: 'createdAt' })
        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(3)
        expect(new Date(data[0].createdAt)).to.be.below(new Date(data[1].createdAt))
        expect(new Date(data[1].createdAt)).to.be.below(new Date(data[2].createdAt))

        base = data

        registrationTokenToDelete = data[0]
        registrationToken = data[1].registrationToken
      }

      {
        const { total, data } = await server.runnerRegistrationTokens.list({ sort: '-createdAt', start: 2, count: 1 })
        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(1)
        expect(data[0].registrationToken).to.equal(base[0].registrationToken)
      }
    })

    it('Should have appropriate registeredRunnersCount for registration tokens', async function () {
      await server.runners.register({ name: 'to delete 1', registrationToken: registrationTokenToDelete.registrationToken })
      await server.runners.register({ name: 'to delete 2', registrationToken: registrationTokenToDelete.registrationToken })

      const { data } = await server.runnerRegistrationTokens.list()

      for (const d of data) {
        if (d.registrationToken === registrationTokenToDelete.registrationToken) {
          expect(d.registeredRunnersCount).to.equal(2)
        } else {
          expect(d.registeredRunnersCount).to.equal(0)
        }
      }

      const { data: runners } = await server.runners.list()
      expect(runners).to.have.lengthOf(2)
    })

    it('Should delete a registration token', async function () {
      await server.runnerRegistrationTokens.delete({ id: registrationTokenToDelete.id })

      const { total, data } = await server.runnerRegistrationTokens.list({ sort: 'createdAt' })
      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      for (const d of data) {
        expect(d.registeredRunnersCount).to.equal(0)
        expect(d.registrationToken).to.not.equal(registrationTokenToDelete.registrationToken)
      }
    })

    it('Should have removed runners of this registration token', async function () {
      const { data: runners } = await server.runners.list()
      expect(runners).to.have.lengthOf(0)
    })
  })

  describe('Managing runners', function () {
    let toDelete: Runner

    it('Should not have runners available', async function () {
      const { total, data } = await server.runners.list()

      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should register runners', async function () {
      const now = new Date()

      const result = await server.runners.register({
        name: 'runner 1',
        description: 'my super runner 1',
        registrationToken
      })
      expect(result.runnerToken).to.exist
      runnerToken = result.runnerToken

      await server.runners.register({
        name: 'runner 2',
        registrationToken
      })

      const { total, data } = await server.runners.list({ sort: 'createdAt' })
      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      for (const d of data) {
        expect(d.id).to.exist
        expect(d.createdAt).to.exist
        expect(d.updatedAt).to.exist
        expect(new Date(d.createdAt)).to.be.above(now)
        expect(new Date(d.updatedAt)).to.be.above(now)
        expect(new Date(d.lastContact)).to.be.above(now)
        expect(d.ip).to.exist
      }

      expect(data[0].name).to.equal('runner 1')
      expect(data[0].description).to.equal('my super runner 1')

      expect(data[1].name).to.equal('runner 2')
      expect(data[1].description).to.be.null

      toDelete = data[1]
    })

    it('Should list runners', async function () {
      const { total, data } = await server.runners.list({ sort: '-createdAt', start: 1, count: 1 })

      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('runner 1')
    })

    it('Should delete a runner', async function () {
      await server.runners.delete({ id: toDelete.id })

      const { total, data } = await server.runners.list()

      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('runner 1')
    })

    it('Should unregister a runner', async function () {
      const registered = await server.runners.autoRegisterRunner()

      {
        const { total, data } = await server.runners.list()
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
      }

      await server.runners.unregister({ runnerToken: registered })

      {
        const { total, data } = await server.runners.list()
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
        expect(data[0].name).to.equal('runner 1')
      }
    })
  })

  describe('Managing runner jobs', function () {
    let jobUUID: string
    let jobToken: string
    let lastRunnerContact: Date
    let failedJob: RunnerJob

    async function checkMainJobState (
      mainJobState: RunnerJobStateType,
      otherJobStates: RunnerJobStateType[] = [ RunnerJobState.PENDING, RunnerJobState.WAITING_FOR_PARENT_JOB ]
    ) {
      const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

      for (const job of data) {
        if (job.uuid === jobUUID) {
          expect(job.state.id).to.equal(mainJobState)
        } else {
          expect(otherJobStates).to.include(job.state.id)
        }
      }
    }

    function getMainJob () {
      return server.runnerJobs.getJob({ uuid: jobUUID })
    }

    describe('List jobs', function () {

      it('Should not have jobs', async function () {
        const { total, data } = await server.runnerJobs.list()

        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      })

      it('Should upload a video and have available jobs', async function () {
        await server.videos.quickUpload({ name: 'to transcode' })
        await waitJobs([ server ])

        const { total, data } = await server.runnerJobs.list()

        expect(data).to.have.lengthOf(10)
        expect(total).to.equal(10)

        for (const job of data) {
          expect(job.startedAt).to.not.exist
          expect(job.finishedAt).to.not.exist
          expect(job.payload).to.exist
          expect(job.privatePayload).to.exist
        }

        const hlsJobs = data.filter(d => d.type === 'vod-hls-transcoding')
        const webVideoJobs = data.filter(d => d.type === 'vod-web-video-transcoding')

        expect(hlsJobs).to.have.lengthOf(5)
        expect(webVideoJobs).to.have.lengthOf(5)

        const pendingJobs = data.filter(d => d.state.id === RunnerJobState.PENDING)
        const waitingJobs = data.filter(d => d.state.id === RunnerJobState.WAITING_FOR_PARENT_JOB)

        expect(pendingJobs).to.have.lengthOf(1)
        expect(waitingJobs).to.have.lengthOf(9)
      })

      it('Should upload another video and list/sort jobs', async function () {
        await server.videos.quickUpload({ name: 'to transcode 2' })
        await waitJobs([ server ])

        {
          const { total, data } = await server.runnerJobs.list({ start: 0, count: 30 })

          expect(data).to.have.lengthOf(20)
          expect(total).to.equal(20)

          jobUUID = data[16].uuid
        }

        {
          const { total, data } = await server.runnerJobs.list({ start: 3, count: 1, sort: 'createdAt' })
          expect(total).to.equal(20)

          expect(data).to.have.lengthOf(1)
          expect(data[0].uuid).to.equal(jobUUID)
        }

        {
          let previousPriority = Infinity
          const { total, data } = await server.runnerJobs.list({ start: 0, count: 100, sort: '-priority' })
          expect(total).to.equal(20)

          for (const job of data) {
            expect(job.priority).to.be.at.most(previousPriority)
            previousPriority = job.priority

            if (job.state.id === RunnerJobState.PENDING) {
              jobMaxPriority = job.uuid
            }
          }
        }
      })

      it('Should search jobs', async function () {
        {
          const { total, data } = await server.runnerJobs.list({ search: jobUUID })

          expect(data).to.have.lengthOf(1)
          expect(total).to.equal(1)

          expect(data[0].uuid).to.equal(jobUUID)
        }

        {
          const { total, data } = await server.runnerJobs.list({ search: 'toto' })

          expect(data).to.have.lengthOf(0)
          expect(total).to.equal(0)
        }

        {
          const { total, data } = await server.runnerJobs.list({ search: 'hls' })

          expect(data).to.not.have.lengthOf(0)
          expect(total).to.not.equal(0)

          for (const job of data) {
            expect(job.type).to.include('hls')
          }
        }
      })

      it('Should filter jobs', async function () {
        {
          const { total, data } = await server.runnerJobs.list({ stateOneOf: [ RunnerJobState.WAITING_FOR_PARENT_JOB ] })

          expect(data).to.not.have.lengthOf(0)
          expect(total).to.not.equal(0)

          for (const job of data) {
            expect(job.state.label).to.equal('Waiting for parent job to finish')
          }
        }

        {
          const { total, data } = await server.runnerJobs.list({ stateOneOf: [ RunnerJobState.COMPLETED ] })

          expect(data).to.have.lengthOf(0)
          expect(total).to.equal(0)
        }
      })
    })

    describe('Accept/update/abort/process a job', function () {

      it('Should request available jobs', async function () {
        lastRunnerContact = new Date()

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })

        // Only optimize jobs are available
        expect(availableJobs).to.have.lengthOf(2)

        for (const job of availableJobs) {
          expect(job.uuid).to.exist
          expect(job.payload.input).to.exist
          expect((job.payload as RunnerJobVODWebVideoTranscodingPayload).output).to.exist

          expect((job as RunnerJobAdmin).privatePayload).to.not.exist
        }

        const hlsJobs = availableJobs.filter(d => d.type === 'vod-hls-transcoding')
        const webVideoJobs = availableJobs.filter(d => d.type === 'vod-web-video-transcoding')

        expect(hlsJobs).to.have.lengthOf(0)
        expect(webVideoJobs).to.have.lengthOf(2)

        jobUUID = webVideoJobs[0].uuid
      })

      it('Should filter requested jobs', async function () {
        {
          const { availableJobs } = await server.runnerJobs.request({ runnerToken, jobTypes: [ 'vod-web-video-transcoding' ] })
          expect(availableJobs).to.have.lengthOf(2)
        }

        {
          const { availableJobs } = await server.runnerJobs.request({ runnerToken, jobTypes: [ 'vod-hls-transcoding' ] })
          expect(availableJobs).to.have.lengthOf(0)
        }
      })

      it('Should have sorted available jobs by priority', async function () {
        const { availableJobs } = await server.runnerJobs.request({ runnerToken })

        expect(availableJobs[0].uuid).to.equal(jobMaxPriority)
      })

      it('Should have last runner contact updated', async function () {
        await wait(1000)

        const { data } = await server.runners.list({ sort: 'createdAt' })
        expect(new Date(data[0].lastContact)).to.be.above(lastRunnerContact)
      })

      it('Should accept a job', async function () {
        const startedAt = new Date()

        const { job } = await server.runnerJobs.accept({ runnerToken, jobUUID })
        jobToken = job.jobToken

        const checkProcessingJob = (job: RunnerJob & { jobToken?: string }, fromAccept: boolean) => {
          expect(job.uuid).to.equal(jobUUID)

          expect(job.type).to.equal('vod-web-video-transcoding')
          expect(job.state.label).to.equal('Processing')
          expect(job.state.id).to.equal(RunnerJobState.PROCESSING)

          expect(job.runner).to.exist
          expect(job.runner.name).to.equal('runner 1')
          expect(job.runner.description).to.equal('my super runner 1')

          expect(job.progress).to.be.null

          expect(job.startedAt).to.exist
          expect(new Date(job.startedAt)).to.be.above(startedAt)

          expect(job.finishedAt).to.not.exist

          expect(job.failures).to.equal(0)

          expect(job.payload).to.exist

          if (fromAccept) {
            expect(job.jobToken).to.exist
            expect((job as RunnerJobAdmin).privatePayload).to.not.exist
          } else {
            expect(job.jobToken).to.not.exist
            expect((job as RunnerJobAdmin).privatePayload).to.exist
          }
        }

        checkProcessingJob(job, true)

        const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

        const processingJob = data.find(j => j.uuid === jobUUID)
        checkProcessingJob(processingJob, false)

        await checkMainJobState(RunnerJobState.PROCESSING)
      })

      it('Should update a job', async function () {
        await server.runnerJobs.update({ runnerToken, jobUUID, jobToken, progress: 53 })

        const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

        for (const job of data) {
          if (job.state.id === RunnerJobState.PROCESSING) {
            expect(job.progress).to.equal(53)
          } else {
            expect(job.progress).to.be.null
          }
        }
      })

      it('Should abort a job', async function () {
        await server.runnerJobs.abort({ runnerToken, jobUUID, jobToken, reason: 'for tests' })

        await checkMainJobState(RunnerJobState.PENDING)

        const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })
        for (const job of data) {
          expect(job.progress).to.be.null
        }
      })

      it('Should accept the same job again and post a success', async function () {
        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        expect(availableJobs.find(j => j.uuid === jobUUID)).to.exist

        const { job } = await server.runnerJobs.accept({ runnerToken, jobUUID })
        jobToken = job.jobToken

        await checkMainJobState(RunnerJobState.PROCESSING)

        const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

        for (const job of data) {
          expect(job.progress).to.be.null
        }

        const payload = {
          videoFile: 'video_short.mp4'
        }

        await server.runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })
      })

      it('Should not have available jobs anymore', async function () {
        await checkMainJobState(RunnerJobState.COMPLETED)

        const job = await getMainJob()
        expect(job.finishedAt).to.exist

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        expect(availableJobs.find(j => j.uuid === jobUUID)).to.not.exist
      })
    })

    describe('Error job', function () {

      it('Should accept another job and post an error', async function () {
        await server.runnerJobs.cancelAllJobs()
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        jobUUID = availableJobs[0].uuid

        const { job } = await server.runnerJobs.accept({ runnerToken, jobUUID })
        jobToken = job.jobToken

        await server.runnerJobs.error({ runnerToken, jobUUID, jobToken, message: 'Error' })
      })

      it('Should have job failures increased', async function () {
        const job = await getMainJob()
        expect(job.state.id).to.equal(RunnerJobState.PENDING)
        expect(job.failures).to.equal(1)
        expect(job.error).to.be.null
        expect(job.progress).to.be.null
        expect(job.finishedAt).to.not.exist
      })

      it('Should error a job when job attempts is too big', async function () {
        for (let i = 0; i < 4; i++) {
          const { job } = await server.runnerJobs.accept({ runnerToken, jobUUID })
          jobToken = job.jobToken

          await server.runnerJobs.error({ runnerToken, jobUUID, jobToken, message: 'Error ' + i })
        }

        const job = await getMainJob()
        expect(job.failures).to.equal(5)
        expect(job.state.id).to.equal(RunnerJobState.ERRORED)
        expect(job.state.label).to.equal('Errored')
        expect(job.error).to.equal('Error 3')
        expect(job.progress).to.be.null
        expect(job.finishedAt).to.exist

        failedJob = job
      })

      it('Should have failed children jobs too', async function () {
        const { data } = await server.runnerJobs.list({ count: 50, sort: '-updatedAt' })

        const children = data.filter(j => j.parent?.uuid === failedJob.uuid)
        expect(children).to.have.lengthOf(5)

        for (const child of children) {
          expect(child.parent.uuid).to.equal(failedJob.uuid)
          expect(child.parent.type).to.equal(failedJob.type)
          expect(child.parent.state.id).to.equal(failedJob.state.id)
          expect(child.parent.state.label).to.equal(failedJob.state.label)

          expect(child.state.id).to.equal(RunnerJobState.PARENT_ERRORED)
          expect(child.state.label).to.equal('Parent job failed')
        }
      })
    })

    describe('Cancel', function () {

      it('Should cancel a pending job', async function () {
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        {
          const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

          const pendingJob = data.find(j => j.state.id === RunnerJobState.PENDING)
          jobUUID = pendingJob.uuid

          await server.runnerJobs.cancelByAdmin({ jobUUID })
        }

        {
          const job = await getMainJob()
          expect(job.state.id).to.equal(RunnerJobState.CANCELLED)
          expect(job.state.label).to.equal('Cancelled')
        }

        {
          const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })
          const children = data.filter(j => j.parent?.uuid === jobUUID)
          expect(children).to.have.lengthOf(5)

          for (const child of children) {
            expect(child.state.id).to.equal(RunnerJobState.PARENT_CANCELLED)
          }
        }
      })

      it('Should cancel an already accepted job and skip success/error', async function () {
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        jobUUID = availableJobs[0].uuid

        const { job } = await server.runnerJobs.accept({ runnerToken, jobUUID })
        jobToken = job.jobToken

        await server.runnerJobs.cancelByAdmin({ jobUUID })

        await server.runnerJobs.abort({ runnerToken, jobUUID, jobToken, reason: 'aborted', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('Remove', function () {

      it('Should remove a pending job', async function () {
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        {
          const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

          const pendingJob = data.find(j => j.state.id === RunnerJobState.PENDING)
          jobUUID = pendingJob.uuid

          await server.runnerJobs.deleteByAdmin({ jobUUID })
        }

        {
          const { data } = await server.runnerJobs.list({ count: 10, sort: '-updatedAt' })

          const parent = data.find(j => j.uuid === jobUUID)
          expect(parent).to.not.exist

          const children = data.filter(j => j.parent?.uuid === jobUUID)
          expect(children).to.have.lengthOf(0)
        }
      })
    })

    describe('Stalled jobs', function () {

      it('Should abort stalled jobs', async function () {
        this.timeout(60000)

        await server.videos.quickUpload({ name: 'video' })
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { job: job1 } = await server.runnerJobs.autoAccept({ runnerToken })
        const { job: stalledJob } = await server.runnerJobs.autoAccept({ runnerToken })

        for (let i = 0; i < 6; i++) {
          await wait(2000)

          await server.runnerJobs.update({ runnerToken, jobToken: job1.jobToken, jobUUID: job1.uuid })
        }

        const refreshedJob1 = await server.runnerJobs.getJob({ uuid: job1.uuid })
        const refreshedStalledJob = await server.runnerJobs.getJob({ uuid: stalledJob.uuid })

        expect(refreshedJob1.state.id).to.equal(RunnerJobState.PROCESSING)
        expect(refreshedStalledJob.state.id).to.equal(RunnerJobState.PENDING)
      })
    })

    describe('Rate limit', function () {

      before(async function () {
        this.timeout(60000)

        await server.kill()

        await server.run({
          rates_limit: {
            api: {
              max: 10
            }
          }
        })
      })

      it('Should rate limit an unknown runner, but not a registered one', async function () {
        this.timeout(60000)

        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { job } = await server.runnerJobs.autoAccept({ runnerToken })

        for (let i = 0; i < 20; i++) {
          try {
            await server.runnerJobs.request({ runnerToken })
            await server.runnerJobs.update({ runnerToken, jobToken: job.jobToken, jobUUID: job.uuid })
          } catch {}
        }

        // Invalid
        {
          await server.runnerJobs.request({ runnerToken: 'toto', expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
          await server.runnerJobs.update({
            runnerToken: 'toto',
            jobToken: job.jobToken,
            jobUUID: job.uuid,
            expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
          })
        }

        // Not provided
        {
          await server.runnerJobs.request({ runnerToken: undefined, expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429 })
          await server.runnerJobs.update({
            runnerToken: undefined,
            jobToken: job.jobToken,
            jobUUID: job.uuid,
            expectedStatus: HttpStatusCode.TOO_MANY_REQUESTS_429
          })
        }

        // Registered
        {
          await server.runnerJobs.request({ runnerToken })
          await server.runnerJobs.update({ runnerToken, jobToken: job.jobToken, jobUUID: job.uuid })
        }
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
