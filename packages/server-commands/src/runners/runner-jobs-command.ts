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
  RunnerJobCustomUpload,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobPayload,
  RunnerJobState,
  RunnerJobStateType,
  RunnerJobSuccessBody,
  RunnerJobSuccessPayload,
  RunnerJobTranscriptionPayload,
  RunnerJobType,
  RunnerJobUpdateBody,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
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

  // ---------------------------------------------------------------------------

  update (options: OverrideCommandOptions & RunnerJobUpdateBody & { jobUUID: string, reqPayload?: RunnerJobPayload }) {
    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/update'

    const { payload } = options
    const attaches: { [id: string]: any } = {}
    const customUploads: (RunnerJobCustomUpload & { file: Blob | string })[] = []

    let payloadWithoutFiles = payload

    if (isLiveRTMPHLSTranscodingUpdatePayload(payload)) {
      const reqPayload = options.reqPayload as RunnerJobLiveRTMPHLSTranscodingPayload

      if (payload.masterPlaylistFile) {
        this.updateUploadPayloads({
          attachesStore: attaches,
          customUploadsStore: customUploads,

          file: payload.masterPlaylistFile,
          attachName: 'masterPlaylistFile',
          customUpload: reqPayload?.output?.masterPlaylistFileCustomUpload
        })

        attaches[`payload[masterPlaylistFile]`] = payload.masterPlaylistFile
      }

      this.updateUploadPayloads({
        attachesStore: attaches,
        customUploadsStore: customUploads,

        file: payload.resolutionPlaylistFile,
        attachName: 'resolutionPlaylistFile',
        customUpload: reqPayload?.output?.resolutionPlaylistFileCustomUpload
      })

      this.updateUploadPayloads({
        attachesStore: attaches,
        customUploadsStore: customUploads,

        file: payload.videoChunkFile,
        attachName: 'videoChunkFile',
        customUpload: reqPayload?.output?.videoChunkFileCustomUpload
      })

      payloadWithoutFiles = omit(payloadWithoutFiles, [ 'masterPlaylistFile', 'resolutionPlaylistFile', 'videoChunkFile' ])
    }

    return this.uploadRunnerJobRequest({
      ...options,

      path,
      fields: {
        ...pick(options, [ 'progress', 'jobToken', 'runnerToken' ]),

        payload: payloadWithoutFiles
      },
      attaches,
      customUploads
    })
  }

  success (options: OverrideCommandOptions & RunnerJobSuccessBody & { jobUUID: string, reqPayload?: RunnerJobPayload }) {
    const { payload } = options

    const path = '/api/v1/runners/jobs/' + options.jobUUID + '/success'
    const attaches: { [id: string]: any } = {}
    const customUploads: (RunnerJobCustomUpload & { file: Blob | string })[] = []

    let payloadWithoutFiles = payload

    if ((isWebVideoOrAudioMergeTranscodingPayloadSuccess(payload) || isHLSTranscodingPayloadSuccess(payload)) && payload.videoFile) {
      const reqPayload = options.reqPayload as RunnerJobVODAudioMergeTranscodingPayload | RunnerJobVODHLSTranscodingPayload

      this.updateUploadPayloads({
        attachesStore: attaches,
        customUploadsStore: customUploads,

        file: payload.videoFile,
        attachName: 'videoFile',
        customUpload: reqPayload?.output?.videoFileCustomUpload
      })

      payloadWithoutFiles = omit(payloadWithoutFiles as VODWebVideoTranscodingSuccess, [ 'videoFile' ])
    }

    if (isHLSTranscodingPayloadSuccess(payload) && payload.resolutionPlaylistFile) {
      const reqPayload = options.reqPayload as RunnerJobVODHLSTranscodingPayload

      this.updateUploadPayloads({
        attachesStore: attaches,
        customUploadsStore: customUploads,

        file: payload.resolutionPlaylistFile,
        attachName: 'resolutionPlaylistFile',
        customUpload: reqPayload?.output?.resolutionPlaylistFileCustomUpload
      })

      payloadWithoutFiles = omit(payloadWithoutFiles as VODHLSTranscodingSuccess, [ 'resolutionPlaylistFile' ])
    }

    if (isTranscriptionPayloadSuccess(payload) && payload.vttFile) {
      const reqPayload = options.reqPayload as RunnerJobTranscriptionPayload

      this.updateUploadPayloads({
        attachesStore: attaches,
        customUploadsStore: customUploads,

        file: payload.vttFile,
        attachName: 'vttFile',
        customUpload: reqPayload?.output?.vttFileCustomUpload
      })

      payloadWithoutFiles = omit(payloadWithoutFiles as TranscriptionSuccess, [ 'vttFile' ])
    }

    return this.uploadRunnerJobRequest({
      ...options,

      path,
      attaches,
      fields: {
        ...pick(options, [ 'jobToken', 'runnerToken' ]),

        payload: payloadWithoutFiles
      },
      customUploads
    })
  }

  private updateUploadPayloads (options: {
    file: Blob | string
    customUpload?: RunnerJobCustomUpload
    attachName: string

    attachesStore: Record<string, string | Blob>
    customUploadsStore: (RunnerJobCustomUpload & { file: Blob | string })[]
  }) {
    if (options.customUpload) {
      options.customUploadsStore.push({ ...options.customUpload, file: options.file })
    } else {
      options.attachesStore[`payload[${options.attachName}]`] = options.file
    }
  }

  private async uploadRunnerJobRequest (options: OverrideCommandOptions & {
    path: string

    fields: { [ fieldName: string ]: any }
    attaches: { [ fieldName: string ]: any }

    customUploads?: (RunnerJobCustomUpload & { file: string | Blob })[]
  }) {
    for (const customUpload of (options.customUploads || [])) {
      await this.customUpload(customUpload)
    }

    await this.postUploadRequest({
      ...omit(options, [ 'customUploads' ]),

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  private customUpload (options: RunnerJobCustomUpload & { file: Blob | string }) {
    const parsedUrl = new URL(options.url)

    const reqOptions = {
      url: parsedUrl.origin,
      path: parsedUrl.pathname,
      attaches: { file: options.file },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    }

    if (options.method === 'POST') return this.postUploadRequest(reqOptions)

    return this.putUploadRequest(reqOptions)
  }

  // ---------------------------------------------------------------------------

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
    await this.success({ runnerToken, jobUUID, jobToken, payload, reqPayload: undefined })

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
