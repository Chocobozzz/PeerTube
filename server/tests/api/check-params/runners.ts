/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@server/tests/shared'
import { HttpStatusCode, RunnerJob, RunnerJobState, RunnerJobSuccessPayload, RunnerJobUpdatePayload, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@shared/server-commands'

const badUUID = '910ec12a-d9e6-458b-a274-0abb655f9464'

describe('Test managing runners', function () {
  let server: PeerTubeServer

  let userToken: string

  let registrationTokenId: number
  let registrationToken: string

  let runnerToken: string
  let runnerToken2: string

  let completedJobToken: string
  let completedJobUUID: string

  let cancelledJobUUID: string

  before(async function () {
    this.timeout(120000)

    const config = {
      rates_limit: {
        api: {
          max: 5000
        }
      }
    }

    server = await createSingleServer(1, config)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userToken = await server.users.generateUserAndToken('user1')

    const { data } = await server.runnerRegistrationTokens.list()
    registrationToken = data[0].registrationToken
    registrationTokenId = data[0].id

    await server.config.enableTranscoding(true, true)
    await server.config.enableRemoteTranscoding()
    runnerToken = await server.runners.autoRegisterRunner()
    runnerToken2 = await server.runners.autoRegisterRunner()

    {
      await server.videos.quickUpload({ name: 'video 1' })
      await server.videos.quickUpload({ name: 'video 2' })

      await waitJobs([ server ])

      {
        const job = await server.runnerJobs.autoProcessWebVideoJob(runnerToken)
        completedJobToken = job.jobToken
        completedJobUUID = job.uuid
      }

      {
        const { job } = await server.runnerJobs.autoAccept({ runnerToken })
        cancelledJobUUID = job.uuid
        await server.runnerJobs.cancelByAdmin({ jobUUID: cancelledJobUUID })
      }
    }
  })

  describe('Managing runner registration tokens', function () {

    describe('Common', function () {

      it('Should fail to generate, list or delete runner registration token without oauth token', async function () {
        const expectedStatus = HttpStatusCode.UNAUTHORIZED_401

        await server.runnerRegistrationTokens.generate({ token: null, expectedStatus })
        await server.runnerRegistrationTokens.list({ token: null, expectedStatus })
        await server.runnerRegistrationTokens.delete({ token: null, id: registrationTokenId, expectedStatus })
      })

      it('Should fail to generate, list or delete runner registration token without admin rights', async function () {
        const expectedStatus = HttpStatusCode.FORBIDDEN_403

        await server.runnerRegistrationTokens.generate({ token: userToken, expectedStatus })
        await server.runnerRegistrationTokens.list({ token: userToken, expectedStatus })
        await server.runnerRegistrationTokens.delete({ token: userToken, id: registrationTokenId, expectedStatus })
      })
    })

    describe('Delete', function () {

      it('Should fail to delete with a bad id', async function () {
        await server.runnerRegistrationTokens.delete({ id: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('List', function () {
      const path = '/api/v1/runners/registration-tokens'

      it('Should fail to list with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with an incorrect sort', async function () {
        await checkBadSortPagination(server.url, path, server.accessToken)
      })

      it('Should succeed to list with the correct params', async function () {
        await server.runnerRegistrationTokens.list({ start: 0, count: 5, sort: '-createdAt' })
      })
    })
  })

  describe('Managing runners', function () {
    let toDeleteId: number

    describe('Register', function () {
      const name = 'runner name'

      it('Should fail with a bad registration token', async function () {
        const expectedStatus = HttpStatusCode.BAD_REQUEST_400

        await server.runners.register({ name, registrationToken: 'a'.repeat(4000), expectedStatus })
        await server.runners.register({ name, registrationToken: null, expectedStatus })
      })

      it('Should fail with an unknown registration token', async function () {
        await server.runners.register({ name, registrationToken: 'aaa', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with a bad name', async function () {
        const expectedStatus = HttpStatusCode.BAD_REQUEST_400

        await server.runners.register({ name: '', registrationToken, expectedStatus })
        await server.runners.register({ name: 'a'.repeat(200), registrationToken, expectedStatus })
      })

      it('Should fail with an invalid description', async function () {
        const expectedStatus = HttpStatusCode.BAD_REQUEST_400

        await server.runners.register({ name, description: '', registrationToken, expectedStatus })
        await server.runners.register({ name, description: 'a'.repeat(5000), registrationToken, expectedStatus })
      })

      it('Should succeed with the correct params', async function () {
        const { id } = await server.runners.register({ name, description: 'super description', registrationToken })

        toDeleteId = id
      })
    })

    describe('Delete', function () {

      it('Should fail without oauth token', async function () {
        await server.runners.delete({ token: null, id: toDeleteId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      })

      it('Should fail without admin rights', async function () {
        await server.runners.delete({ token: userToken, id: toDeleteId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })

      it('Should fail with a bad id', async function () {
        await server.runners.delete({ id: 'hi' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown id', async function () {
        await server.runners.delete({ id: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should succeed with the correct params', async function () {
        await server.runners.delete({ id: toDeleteId })
      })
    })

    describe('List', function () {
      const path = '/api/v1/runners'

      it('Should fail without oauth token', async function () {
        await server.runners.list({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      })

      it('Should fail without admin rights', async function () {
        await server.runners.list({ token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })

      it('Should fail to list with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with an incorrect sort', async function () {
        await checkBadSortPagination(server.url, path, server.accessToken)
      })

      it('Should succeed to list with the correct params', async function () {
        await server.runners.list({ start: 0, count: 5, sort: '-createdAt' })
      })
    })

  })

  describe('Runner jobs by admin', function () {

    describe('Cancel', function () {
      let jobUUID: string

      before(async function () {
        this.timeout(60000)

        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        jobUUID = availableJobs[0].uuid
      })

      it('Should fail without oauth token', async function () {
        await server.runnerJobs.cancelByAdmin({ token: null, jobUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      })

      it('Should fail without admin rights', async function () {
        await server.runnerJobs.cancelByAdmin({ token: userToken, jobUUID, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })

      it('Should fail with a bad job uuid', async function () {
        await server.runnerJobs.cancelByAdmin({ jobUUID: 'hello', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown job uuid', async function () {
        const jobUUID = badUUID
        await server.runnerJobs.cancelByAdmin({ jobUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should succeed with the correct params', async function () {
        await server.runnerJobs.cancelByAdmin({ jobUUID })
      })
    })

    describe('List', function () {
      const path = '/api/v1/runners/jobs'

      it('Should fail without oauth token', async function () {
        await server.runnerJobs.list({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      })

      it('Should fail without admin rights', async function () {
        await server.runnerJobs.list({ token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })

      it('Should fail to list with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path, server.accessToken)
      })

      it('Should fail to list with an incorrect sort', async function () {
        await checkBadSortPagination(server.url, path, server.accessToken)
      })

      it('Should succeed to list with the correct params', async function () {
        await server.runnerJobs.list({ start: 0, count: 5, sort: '-createdAt' })
      })
    })

  })

  describe('Runner jobs by runners', function () {
    let jobUUID: string
    let jobToken: string
    let videoUUID: string

    let jobUUID2: string
    let jobToken2: string

    let videoUUID2: string

    let pendingUUID: string

    let liveAcceptedJob: RunnerJob & { jobToken: string }

    async function fetchFiles (options: {
      jobUUID: string
      videoUUID: string
      runnerToken: string
      jobToken: string
      expectedStatus: HttpStatusCode
    }) {
      const { jobUUID, expectedStatus, videoUUID, runnerToken, jobToken } = options

      const basePath = '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID
      const paths = [ `${basePath}/max-quality`, `${basePath}/previews/max-quality` ]

      for (const path of paths) {
        await makePostBodyRequest({ url: server.url, path, fields: { runnerToken, jobToken }, expectedStatus })
      }
    }

    before(async function () {
      this.timeout(120000)

      {
        await server.runnerJobs.cancelAllJobs({ state: RunnerJobState.PENDING })
      }

      {
        const { uuid } = await server.videos.quickUpload({ name: 'video' })
        videoUUID = uuid

        await waitJobs([ server ])

        const { job } = await server.runnerJobs.autoAccept({ runnerToken })
        jobUUID = job.uuid
        jobToken = job.jobToken
      }

      {
        const { uuid } = await server.videos.quickUpload({ name: 'video' })
        videoUUID2 = uuid

        await waitJobs([ server ])

        const { job } = await server.runnerJobs.autoAccept({ runnerToken: runnerToken2 })
        jobUUID2 = job.uuid
        jobToken2 = job.jobToken
      }

      {
        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        pendingUUID = availableJobs[0].uuid
      }

      {
        await server.config.enableLive({
          allowReplay: false,
          resolutions: 'max',
          transcoding: true
        })

        const { live } = await server.live.quickCreate({ permanentLive: true, saveReplay: false, privacy: VideoPrivacy.PUBLIC })

        const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
        await waitJobs([ server ])

        await server.runnerJobs.requestLiveJob(runnerToken)

        const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'live-rtmp-hls-transcoding' })
        liveAcceptedJob = job

        await stopFfmpeg(ffmpegCommand)
      }
    })

    describe('Common runner tokens validations', function () {

      async function testEndpoints (options: {
        jobUUID: string
        runnerToken: string
        jobToken: string
        expectedStatus: HttpStatusCode
      }) {
        await fetchFiles({ ...options, videoUUID })

        await server.runnerJobs.abort({ ...options, reason: 'reason' })
        await server.runnerJobs.update({ ...options })
        await server.runnerJobs.error({ ...options, message: 'message' })
        await server.runnerJobs.success({ ...options, payload: { videoFile: 'video_short.mp4' } })
      }

      it('Should fail with an invalid job uuid', async function () {
        await testEndpoints({ jobUUID: 'a', runnerToken, jobToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown job uuid', async function () {
        const jobUUID = badUUID
        await testEndpoints({ jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with an invalid runner token', async function () {
        await testEndpoints({ jobUUID, runnerToken: '', jobToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown runner token', async function () {
        const runnerToken = badUUID
        await testEndpoints({ jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with an invalid job token job uuid', async function () {
        await testEndpoints({ jobUUID, runnerToken, jobToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown job token job uuid', async function () {
        const jobToken = badUUID
        await testEndpoints({ jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with a runner token not associated to this job', async function () {
        await testEndpoints({ jobUUID, runnerToken: runnerToken2, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with a job uuid not associated to the job token', async function () {
        await testEndpoints({ jobUUID: jobUUID2, runnerToken, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        await testEndpoints({ jobUUID, runnerToken, jobToken: jobToken2, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('Unregister', function () {

      it('Should fail without a runner token', async function () {
        await server.runners.unregister({ runnerToken: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a bad a runner token', async function () {
        await server.runners.unregister({ runnerToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown runner token', async function () {
        await server.runners.unregister({ runnerToken: badUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('Request', function () {

      it('Should fail without a runner token', async function () {
        await server.runnerJobs.request({ runnerToken: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a bad a runner token', async function () {
        await server.runnerJobs.request({ runnerToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown runner token', async function () {
        await server.runnerJobs.request({ runnerToken: badUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('Accept', function () {

      it('Should fail with a bad a job uuid', async function () {
        await server.runnerJobs.accept({ jobUUID: '', runnerToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown job uuid', async function () {
        await server.runnerJobs.accept({ jobUUID: badUUID, runnerToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should fail with a job not in pending state', async function () {
        await server.runnerJobs.accept({ jobUUID: completedJobUUID, runnerToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        await server.runnerJobs.accept({ jobUUID: cancelledJobUUID, runnerToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail without a runner token', async function () {
        await server.runnerJobs.accept({ jobUUID: pendingUUID, runnerToken: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a bad a runner token', async function () {
        await server.runnerJobs.accept({ jobUUID: pendingUUID, runnerToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown runner token', async function () {
        await server.runnerJobs.accept({ jobUUID: pendingUUID, runnerToken: badUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })
    })

    describe('Abort', function () {

      it('Should fail without a reason', async function () {
        await server.runnerJobs.abort({ jobUUID, jobToken, runnerToken, reason: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a bad reason', async function () {
        const reason = 'reason'.repeat(5000)
        await server.runnerJobs.abort({ jobUUID, jobToken, runnerToken, reason, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a job not in processing state', async function () {
        await server.runnerJobs.abort({
          jobUUID: completedJobUUID,
          jobToken: completedJobToken,
          runnerToken,
          reason: 'reason',
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })
    })

    describe('Update', function () {

      describe('Common', function () {

        it('Should fail with an invalid progress', async function () {
          await server.runnerJobs.update({ jobUUID, jobToken, runnerToken, progress: 101, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        })

        it('Should fail with a job not in processing state', async function () {
          await server.runnerJobs.update({
            jobUUID: completedJobUUID,
            jobToken: completedJobToken,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })
      })

      describe('Live RTMP to HLS', function () {
        const base: RunnerJobUpdatePayload = {
          masterPlaylistFile: 'live/master.m3u8',
          resolutionPlaylistFilename: '0.m3u8',
          resolutionPlaylistFile: 'live/1.m3u8',
          type: 'add-chunk',
          videoChunkFile: 'live/1-000069.ts',
          videoChunkFilename: '1-000068.ts'
        }

        function testUpdate (payload: RunnerJobUpdatePayload) {
          return server.runnerJobs.update({
            jobUUID: liveAcceptedJob.uuid,
            jobToken: liveAcceptedJob.jobToken,
            payload,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        }

        it('Should fail with an invalid resolutionPlaylistFilename', async function () {
          await testUpdate({ ...base, resolutionPlaylistFilename: undefined })
          await testUpdate({ ...base, resolutionPlaylistFilename: 'coucou/hello' })
          await testUpdate({ ...base, resolutionPlaylistFilename: 'hello' })
        })

        it('Should fail with an invalid videoChunkFilename', async function () {
          await testUpdate({ ...base, resolutionPlaylistFilename: undefined })
          await testUpdate({ ...base, resolutionPlaylistFilename: 'coucou/hello' })
          await testUpdate({ ...base, resolutionPlaylistFilename: 'hello' })
        })

        it('Should fail with an invalid type', async function () {
          await testUpdate({ ...base, type: undefined })
          await testUpdate({ ...base, type: 'toto' as any })
        })

        it('Should succeed with the correct params', async function () {
          await server.runnerJobs.update({
            jobUUID: liveAcceptedJob.uuid,
            jobToken: liveAcceptedJob.jobToken,
            payload: base,
            runnerToken
          })

          await server.runnerJobs.update({
            jobUUID: liveAcceptedJob.uuid,
            jobToken: liveAcceptedJob.jobToken,
            payload: { ...base, masterPlaylistFile: undefined },
            runnerToken
          })
        })
      })
    })

    describe('Error', function () {

      it('Should fail with a missing error message', async function () {
        await server.runnerJobs.error({ jobUUID, jobToken, runnerToken, message: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an invalid error messgae', async function () {
        const message = 'a'.repeat(6000)
        await server.runnerJobs.error({ jobUUID, jobToken, runnerToken, message, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with a job not in processing state', async function () {
        await server.runnerJobs.error({
          jobUUID: completedJobUUID,
          jobToken: completedJobToken,
          message: 'my message',
          runnerToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })
    })

    describe('Success', function () {
      let vodJobUUID: string
      let vodJobToken: string

      describe('Common', function () {

        it('Should fail with a job not in processing state', async function () {
          await server.runnerJobs.success({
            jobUUID: completedJobUUID,
            jobToken: completedJobToken,
            payload: { videoFile: 'video_short.mp4' },
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })
      })

      describe('VOD', function () {

        it('Should fail with an invalid vod web video payload', async function () {
          const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'vod-web-video-transcoding' })

          await server.runnerJobs.success({
            jobUUID: job.uuid,
            jobToken: job.jobToken,
            payload: { hello: 'video_short.mp4' } as any,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })

          vodJobUUID = job.uuid
          vodJobToken = job.jobToken
        })

        it('Should fail with an invalid vod hls payload', async function () {
          // To create HLS jobs
          const payload: RunnerJobSuccessPayload = { videoFile: 'video_short.mp4' }
          await server.runnerJobs.success({ runnerToken, jobUUID: vodJobUUID, jobToken: vodJobToken, payload })

          await waitJobs([ server ])

          const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'vod-hls-transcoding' })

          await server.runnerJobs.success({
            jobUUID: job.uuid,
            jobToken: job.jobToken,
            payload: { videoFile: 'video_short.mp4' } as any,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })

        it('Should fail with an invalid vod audio merge payload', async function () {
          const attributes = { name: 'audio_with_preview', previewfile: 'preview.jpg', fixture: 'sample.ogg' }
          await server.videos.upload({ attributes, mode: 'legacy' })

          await waitJobs([ server ])

          const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'vod-audio-merge-transcoding' })

          await server.runnerJobs.success({
            jobUUID: job.uuid,
            jobToken: job.jobToken,
            payload: { hello: 'video_short.mp4' } as any,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })
      })
    })

    describe('Job files', function () {

      describe('Video files', function () {

        it('Should fail with an invalid video id', async function () {
          await fetchFiles({ videoUUID: 'a', jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
        })

        it('Should fail with an unknown video id', async function () {
          const videoUUID = '910ec12a-d9e6-458b-a274-0abb655f9464'
          await fetchFiles({ videoUUID, jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        })

        it('Should fail with a video id not associated to this job', async function () {
          await fetchFiles({ videoUUID: videoUUID2, jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        })

        it('Should succeed with the correct params', async function () {
          await fetchFiles({ videoUUID, jobUUID, runnerToken, jobToken, expectedStatus: HttpStatusCode.OK_200 })
        })
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
