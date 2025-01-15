/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import {
  HttpStatusCode,
  HttpStatusCodeType,
  isVideoStudioTaskIntro,
  RunnerJob,
  RunnerJobState,
  RunnerJobStudioTranscodingPayload,
  RunnerJobSuccessPayload,
  RunnerJobUpdatePayload,
  VideoPrivacy,
  VideoStudioTaskIntro
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  VideoStudioCommand,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { basename } from 'path'

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

  let cancelledJobToken: string
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

    await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'min' })
    await server.config.enableStudio()
    await server.config.enableRemoteTranscoding()
    await server.config.enableRemoteStudio()

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
        cancelledJobToken = job.jobToken
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

      it('Should fail with the same runner name', async function () {
        await server.runners.register({
          name,
          description: 'super description',
          registrationToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
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

      it('Should fail with an invalid state', async function () {
        await server.runners.list({ start: 0, count: 5, sort: '-createdAt' })
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

      it('Should fail with an already cancelled job', async function () {
        await server.runnerJobs.cancelByAdmin({ jobUUID: cancelledJobUUID, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
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

      it('Should fail with an invalid state', async function () {
        await server.runnerJobs.list({ start: 0, count: 5, sort: '-createdAt', stateOneOf: 42 as any })
        await server.runnerJobs.list({ start: 0, count: 5, sort: '-createdAt', stateOneOf: [ 42 ] as any })
      })

      it('Should succeed with the correct params', async function () {
        await server.runnerJobs.list({ start: 0, count: 5, sort: '-createdAt', stateOneOf: [ RunnerJobState.COMPLETED ] })
      })
    })

    describe('Delete', function () {
      let jobUUID: string

      before(async function () {
        this.timeout(60000)

        await server.videos.quickUpload({ name: 'video' })
        await waitJobs([ server ])

        const { availableJobs } = await server.runnerJobs.request({ runnerToken })
        jobUUID = availableJobs[0].uuid
      })

      it('Should fail without oauth token', async function () {
        await server.runnerJobs.deleteByAdmin({ token: null, jobUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      })

      it('Should fail without admin rights', async function () {
        await server.runnerJobs.deleteByAdmin({ token: userToken, jobUUID, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      })

      it('Should fail with a bad job uuid', async function () {
        await server.runnerJobs.deleteByAdmin({ jobUUID: 'hello', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should fail with an unknown job uuid', async function () {
        const jobUUID = badUUID
        await server.runnerJobs.deleteByAdmin({ jobUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      })

      it('Should succeed with the correct params', async function () {
        await server.runnerJobs.deleteByAdmin({ jobUUID })
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

    let videoStudioUUID: string
    let studioFile: string

    let liveAcceptedJob: RunnerJob & { jobToken: string }
    let studioAcceptedJob: RunnerJob & { jobToken: string }

    async function fetchVideoInputFiles (options: {
      jobUUID: string
      videoUUID: string
      runnerToken: string
      jobToken: string
      expectedStatus: HttpStatusCodeType
    }) {
      const { jobUUID, expectedStatus, videoUUID, runnerToken, jobToken } = options

      const basePath = '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID
      const paths = [ `${basePath}/max-quality`, `${basePath}/previews/max-quality` ]

      for (const path of paths) {
        await makePostBodyRequest({ url: server.url, path, fields: { runnerToken, jobToken }, expectedStatus })
      }
    }

    async function fetchStudioFiles (options: {
      jobUUID: string
      videoUUID: string
      runnerToken: string
      jobToken: string
      studioFile?: string
      expectedStatus: HttpStatusCodeType
    }) {
      const { jobUUID, expectedStatus, videoUUID, runnerToken, jobToken, studioFile } = options

      const path = `/api/v1/runners/jobs/${jobUUID}/files/videos/${videoUUID}/studio/task-files/${studioFile}`

      await makePostBodyRequest({ url: server.url, path, fields: { runnerToken, jobToken }, expectedStatus })
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
        await server.config.disableTranscoding()

        const { uuid } = await server.videos.quickUpload({ name: 'video studio' })
        videoStudioUUID = uuid

        await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'min' })
        await server.config.enableStudio()

        await server.videoStudio.createEditionTasks({
          videoId: videoStudioUUID,
          tasks: VideoStudioCommand.getComplexTask()
        })

        const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'video-studio-transcoding' })
        studioAcceptedJob = job

        const tasks = (job.payload as RunnerJobStudioTranscodingPayload).tasks
        const fileUrl = (tasks.find(t => isVideoStudioTaskIntro(t)) as VideoStudioTaskIntro).options.file as string
        studioFile = basename(fileUrl)
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
        expectedStatus: HttpStatusCodeType
      }) {
        await server.runnerJobs.abort({ ...options, reason: 'reason' })
        await server.runnerJobs.update({ ...options })
        await server.runnerJobs.error({ ...options, message: 'message' })
        await server.runnerJobs.success({ ...options, payload: { videoFile: 'video_short.mp4' } })
      }

      it('Should fail with an invalid job uuid', async function () {
        const options = { jobUUID: 'a', runnerToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 }

        await testEndpoints({ ...options, jobToken })
        await fetchVideoInputFiles({ ...options, videoUUID, jobToken })
        await fetchStudioFiles({ ...options, videoUUID, jobToken: studioAcceptedJob.jobToken, studioFile })
      })

      it('Should fail with an unknown job uuid', async function () {
        const options = { jobUUID: badUUID, runnerToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

        await testEndpoints({ ...options, jobToken })
        await fetchVideoInputFiles({ ...options, videoUUID, jobToken })
        await fetchStudioFiles({ ...options, jobToken: studioAcceptedJob.jobToken, videoUUID, studioFile })
      })

      it('Should fail with an invalid runner token', async function () {
        const options = { runnerToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 }

        await testEndpoints({ ...options, jobUUID, jobToken })
        await fetchVideoInputFiles({ ...options, jobUUID, videoUUID, jobToken })
        await fetchStudioFiles({
          ...options,
          jobToken: studioAcceptedJob.jobToken,
          jobUUID: studioAcceptedJob.uuid,
          videoUUID: videoStudioUUID,
          studioFile
        })
      })

      it('Should fail with an unknown runner token', async function () {
        const options = { runnerToken: badUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

        await testEndpoints({ ...options, jobUUID, jobToken })
        await fetchVideoInputFiles({ ...options, jobUUID, videoUUID, jobToken })
        await fetchStudioFiles({
          ...options,
          jobToken: studioAcceptedJob.jobToken,
          jobUUID: studioAcceptedJob.uuid,
          videoUUID: videoStudioUUID,
          studioFile
        })
      })

      it('Should fail with an invalid job token job uuid', async function () {
        const options = { runnerToken, jobToken: '', expectedStatus: HttpStatusCode.BAD_REQUEST_400 }

        await testEndpoints({ ...options, jobUUID })
        await fetchVideoInputFiles({ ...options, jobUUID, videoUUID })
        await fetchStudioFiles({ ...options, jobUUID: studioAcceptedJob.uuid, videoUUID: videoStudioUUID, studioFile })
      })

      it('Should fail with an unknown job token job uuid', async function () {
        const options = { runnerToken, jobToken: badUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

        await testEndpoints({ ...options, jobUUID })
        await fetchVideoInputFiles({ ...options, jobUUID, videoUUID })
        await fetchStudioFiles({ ...options, jobUUID: studioAcceptedJob.uuid, videoUUID: videoStudioUUID, studioFile })
      })

      it('Should fail with a runner token not associated to this job', async function () {
        const options = { runnerToken: runnerToken2, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

        await testEndpoints({ ...options, jobUUID, jobToken })
        await fetchVideoInputFiles({ ...options, jobUUID, videoUUID, jobToken })
        await fetchStudioFiles({
          ...options,
          jobToken: studioAcceptedJob.jobToken,
          jobUUID: studioAcceptedJob.uuid,
          videoUUID: videoStudioUUID,
          studioFile
        })
      })

      it('Should fail with a job uuid not associated to the job token', async function () {
        {
          const options = { jobUUID: jobUUID2, runnerToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

          await testEndpoints({ ...options, jobToken })
          await fetchVideoInputFiles({ ...options, jobToken, videoUUID })
          await fetchStudioFiles({ ...options, jobToken: studioAcceptedJob.jobToken, videoUUID: videoStudioUUID, studioFile })
        }

        {
          const options = { runnerToken, jobToken: jobToken2, expectedStatus: HttpStatusCode.NOT_FOUND_404 }

          await testEndpoints({ ...options, jobUUID })
          await fetchVideoInputFiles({ ...options, jobUUID, videoUUID })
          await fetchStudioFiles({ ...options, jobUUID: studioAcceptedJob.uuid, videoUUID: videoStudioUUID, studioFile })
        }
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

      it('Should fail with a bad jobTypes token', async function () {
        await server.runnerJobs.request({ runnerToken, jobTypes: 'toto' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      })

      it('Should succeed with the correct params', async function () {
        await server.runnerJobs.request({ runnerToken, jobTypes: [] })
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
            jobUUID: cancelledJobUUID,
            jobToken: cancelledJobToken,
            runnerToken,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
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
          const attributes = { name: 'audio_with_preview', previewfile: 'custom-preview.jpg', fixture: 'sample.ogg' }
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

      describe('Video studio', function () {

        it('Should fail with an invalid video studio transcoding payload', async function () {
          await server.runnerJobs.success({
            jobUUID: studioAcceptedJob.uuid,
            jobToken: studioAcceptedJob.jobToken,
            payload: { hello: 'video_short.mp4' } as any,
            runnerToken,
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })
      })
    })

    describe('Job files', function () {

      describe('Check video param for common job file routes', function () {

        async function fetchFiles (options: {
          videoUUID?: string
          expectedStatus: HttpStatusCodeType
        }) {
          await fetchVideoInputFiles({ videoUUID, ...options, jobToken, jobUUID, runnerToken })

          await fetchStudioFiles({
            videoUUID: videoStudioUUID,

            ...options,

            jobToken: studioAcceptedJob.jobToken,
            jobUUID: studioAcceptedJob.uuid,
            runnerToken,
            studioFile
          })
        }

        it('Should fail with an invalid video id', async function () {
          await fetchFiles({
            videoUUID: 'a',
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })

        it('Should fail with an unknown video id', async function () {
          const videoUUID = '910ec12a-d9e6-458b-a274-0abb655f9464'

          await fetchFiles({
            videoUUID,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should fail with a video id not associated to this job', async function () {
          await fetchFiles({
            videoUUID: videoUUID2,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        })

        it('Should succeed with the correct params', async function () {
          await fetchFiles({ expectedStatus: HttpStatusCode.OK_200 })
        })
      })

      describe('Video studio tasks file routes', function () {

        it('Should fail with an invalid studio filename', async function () {
          await fetchStudioFiles({
            videoUUID: videoStudioUUID,
            jobUUID: studioAcceptedJob.uuid,
            runnerToken,
            jobToken: studioAcceptedJob.jobToken,
            studioFile: 'toto',
            expectedStatus: HttpStatusCode.BAD_REQUEST_400
          })
        })
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
