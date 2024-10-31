import { omit, pick, wait } from '@peertube/peertube-core-utils'
import {
  AbortRunnerJobBody,
  AcceptRunnerJobBody,
  AcceptRunnerJobResult,
  ErrorRunnerJobBody,
  HttpStatusCode,
  ListRunnerJobsQuery,
  RequestRunnerJobBody,
  RequestRunnerJobResult,
  ResultList,
  RunnerJobAdmin,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobPayload,
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobSuccessBody,
  RunnerJobSuccessPayload,
  RunnerJobType,
  RunnerJobUpdateBody,
  RunnerJobVODPayload,
  TranscriptionSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess,
  isHLSTranscodingPayloadSuccess,
  isLiveRTMPHLSTranscodingUpdatePayload,
  isTranscriptionPayloadSuccess,
  isWebVideoOrAudioMergeTranscodingPayloadSuccess
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { waitJobs } from '../server/jobs.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class RunnerJobsCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & ListRunnerJobsQuery = {}) {
    const path = '/api/v1/runners/jobs'

    return this.getRequestBody<ResultList<RunnerJobAdmin>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'search', 'stateOneOf' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  cancelByAdmin (options: OverrideCommandOptions & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/cancel'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  deleteByAdmin (options: OverrideCommandOptions & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  request (options: OverrideCommandOptions & RequestRunnerJobBody) {
    const path = '/api/v1/runners/jobs/request'

    return unwrapBody<RequestRunnerJobResult>(this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'runnerToken', 'jobTypes' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  async requestVOD (options: OverrideCommandOptions & RequestRunnerJobBody) {
    const { availableJobs } = await this.request({
      ...options,

      jobTypes: [ 'vod-audio-merge-transcoding', 'vod-hls-transcoding', 'vod-web-video-transcoding' ]
    })

    return { availableJobs } as RequestRunnerJobResult<RunnerJobVODPayload>
  }

  async requestLive (options: OverrideCommandOptions & RequestRunnerJobBody) {
    const { availableJobs } = await this.request({
      ...options,

      jobTypes: [ 'live-rtmp-hls-transcoding' ]
    })

    return { availableJobs } as RequestRunnerJobResult<RunnerJobLiveRTMPHLSTranscodingPayload>
  }

  // ---------------------------------------------------------------------------

  accept <T extends RunnerJobPayload = RunnerJobPayload> (options: OverrideCommandOptions & AcceptRunnerJobBody & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/accept'

    return unwrapBody<AcceptRunnerJobResult<T>>(this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'runnerToken' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  abort (options: OverrideCommandOptions & AbortRunnerJobBody & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/abort'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'reason', 'jobToken', 'runnerToken' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  update (options: OverrideCommandOptions & RunnerJobUpdateBody & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/update'

    const { payload } = options
    const attaches: { [id: string]: any } = {}
    let payloadWithoutFiles = payload

    if (isLiveRTMPHLSTranscodingUpdatePayload(payload)) {
      if (payload.masterPlaylistFile) {
        attaches[`payload[masterPlaylistFile]`] = payload.masterPlaylistFile
      }

      attaches[`payload[resolutionPlaylistFile]`] = payload.resolutionPlaylistFile
      attaches[`payload[videoChunkFile]`] = payload.videoChunkFile

      payloadWithoutFiles = omit(payloadWithoutFiles, [ 'masterPlaylistFile', 'resolutionPlaylistFile', 'videoChunkFile' ])
    }

    return this.postUploadRequest({
      ...options,

      path,
      fields: {
        ...pick(options, [ 'progress', 'jobToken', 'runnerToken' ]),

        payload: payloadWithoutFiles
      },
      attaches,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  error (options: OverrideCommandOptions & ErrorRunnerJobBody & { jobUUID: string }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/error'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'message', 'jobToken', 'runnerToken' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  success (options: OverrideCommandOptions & RunnerJobSuccessBody & { jobUUID: string }) {
    const { payload } = options

    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/success'
    const attaches: { [id: string]: any } = {}
    let payloadWithoutFiles = payload

    if ((isWebVideoOrAudioMergeTranscodingPayloadSuccess(payload) || isHLSTranscodingPayloadSuccess(payload)) && payload.videoFile) {
      attaches[`payload[videoFile]`] = payload.videoFile

      payloadWithoutFiles = omit(payloadWithoutFiles as VODWebVideoTranscodingSuccess, [ 'videoFile' ])
    }

    if (isHLSTranscodingPayloadSuccess(payload) && payload.resolutionPlaylistFile) {
      attaches[`payload[resolutionPlaylistFile]`] = payload.resolutionPlaylistFile

      payloadWithoutFiles = omit(payloadWithoutFiles as VODHLSTranscodingSuccess, [ 'resolutionPlaylistFile' ])
    }

    if (isTranscriptionPayloadSuccess(payload) && payload.vttFile) {
      attaches[`payload[vttFile]`] = payload.vttFile

      payloadWithoutFiles = omit(payloadWithoutFiles as TranscriptionSuccess, [ 'vttFile' ])
    }

    return this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: {
        ...pick(options, [ 'jobToken', 'runnerToken' ]),

        payload: payloadWithoutFiles
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  getJobFile (options: OverrideCommandOptions & { url: string, jobToken: string, runnerToken: string }) {
    const { host, protocol, pathname } = new URL(options.url)

    return this.postBodyRequest({
      url: `${protocol}//${host}`,
      path: pathname,

      fields: pick(options, [ 'jobToken', 'runnerToken' ]),
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  async autoAccept (options: OverrideCommandOptions & RequestRunnerJobBody & { type?: RunnerJobType }) {
    const { availableJobs } = await this.request(options)

    const job = options.type
      ? availableJobs.find(j => j.type === options.type)
      : availableJobs[0]

    return this.accept({ ...options, jobUUID: job.uuid })
  }

  async autoProcessWebVideoJob (runnerToken: string, jobUUIDToProcess?: string) {
    let jobUUID = jobUUIDToProcess

    if (!jobUUID) {
      const { availableJobs } = await this.request({ runnerToken })
      jobUUID = availableJobs[0].uuid
    }

    const { job } = await this.accept({ runnerToken, jobUUID })
    const jobToken = job.jobToken

    const payload: RunnerJobSuccessPayload = { videoFile: 'video_short.mp4' }
    await this.success({ runnerToken, jobUUID, jobToken, payload })

    await waitJobs([ this.server ])

    return job
  }

  async cancelAllJobs (options: { state?: RunnerJobStateType } = {}) {
    const { state } = options

    const { data } = await this.list({ count: 100 })

    const allowedStates = new Set<RunnerJobStateType>([
      RunnerJobState.PENDING,
      RunnerJobState.PROCESSING,
      RunnerJobState.WAITING_FOR_PARENT_JOB
    ])

    for (const job of data) {
      if (state && job.state.id !== state) continue
      else if (allowedStates.has(job.state.id) !== true) continue

      await this.cancelByAdmin({ jobUUID: job.uuid })
    }
  }

  async getJob (options: OverrideCommandOptions & { uuid: string }) {
    const { data } = await this.list({ ...options, count: 100, sort: '-updatedAt' })

    return data.find(j => j.uuid === options.uuid)
  }

  async requestLiveJob (runnerToken: string) {
    let availableJobs: RequestRunnerJobResult<RunnerJobLiveRTMPHLSTranscodingPayload>['availableJobs'] = []

    while (availableJobs.length === 0) {
      const result = await this.requestLive({ runnerToken })
      availableJobs = result.availableJobs

      if (availableJobs.length === 1) break

      await wait(150)
    }

    return availableJobs[0]
  }
}
