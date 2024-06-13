import {
  LiveRTMPHLSTranscodingSuccess,
  RunnerJobSuccessPayload,
  RunnerJobType,
  RunnerJobUpdatePayload,
  TranscriptionSuccess,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess,
  VideoStudioTranscodingSuccess
} from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS, RUNNER_JOB_STATES } from '@server/initializers/constants.js'
import { UploadFilesForCheck } from 'express'
import validator from 'validator'
import { exists, isArray, isFileValid, isSafeFilename } from '../misc.js'

const RUNNER_JOBS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.RUNNER_JOBS

const runnerJobTypes = new Set([ 'vod-hls-transcoding', 'vod-web-video-transcoding', 'vod-audio-merge-transcoding' ])
export function isRunnerJobTypeValid (value: RunnerJobType) {
  return runnerJobTypes.has(value)
}

export function isRunnerJobSuccessPayloadValid (value: RunnerJobSuccessPayload, type: RunnerJobType, files: UploadFilesForCheck) {
  return isRunnerJobVODWebVideoResultPayloadValid(value as VODWebVideoTranscodingSuccess, type, files) ||
    isRunnerJobVODHLSResultPayloadValid(value as VODHLSTranscodingSuccess, type, files) ||
    isRunnerJobVODAudioMergeResultPayloadValid(value as VODHLSTranscodingSuccess, type, files) ||
    isRunnerJobLiveRTMPHLSResultPayloadValid(value as LiveRTMPHLSTranscodingSuccess, type) ||
    isRunnerJobVideoStudioResultPayloadValid(value as VideoStudioTranscodingSuccess, type, files) ||
    isRunnerJobTranscriptionResultPayloadValid(value as TranscriptionSuccess, type, files)
}

// ---------------------------------------------------------------------------

export function isRunnerJobProgressValid (value: string) {
  return validator.default.isInt(value + '', RUNNER_JOBS_CONSTRAINTS_FIELDS.PROGRESS)
}

export function isRunnerJobUpdatePayloadValid (value: RunnerJobUpdatePayload, type: RunnerJobType, files: UploadFilesForCheck) {
  return isRunnerJobVODWebVideoUpdatePayloadValid(value, type, files) ||
    isRunnerJobVODHLSUpdatePayloadValid(value, type, files) ||
    isRunnerJobVideoStudioUpdatePayloadValid(value, type, files) ||
    isRunnerJobVODAudioMergeUpdatePayloadValid(value, type, files) ||
    isRunnerJobLiveRTMPHLSUpdatePayloadValid(value, type, files) ||
    isRunnerJobTranscriptionUpdatePayloadValid(value, type, files)
}

// ---------------------------------------------------------------------------

export function isRunnerJobTokenValid (value: string) {
  return exists(value) && validator.default.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.TOKEN)
}

export function isRunnerJobAbortReasonValid (value: string) {
  return validator.default.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.REASON)
}

export function isRunnerJobErrorMessageValid (value: string) {
  return validator.default.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.ERROR_MESSAGE)
}

export function isRunnerJobStateValid (value: any) {
  return exists(value) && RUNNER_JOB_STATES[value] !== undefined
}

export function isRunnerJobArrayOfStateValid (value: any) {
  return isArray(value) && value.every(v => isRunnerJobStateValid(v))
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isRunnerJobVODWebVideoResultPayloadValid (
  _value: VODWebVideoTranscodingSuccess,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  return type === 'vod-web-video-transcoding' &&
    isFileValid({ files, field: 'payload[videoFile]', mimeTypeRegex: null, maxSize: null })
}

function isRunnerJobVODHLSResultPayloadValid (
  _value: VODHLSTranscodingSuccess,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  return type === 'vod-hls-transcoding' &&
    isFileValid({ files, field: 'payload[videoFile]', mimeTypeRegex: null, maxSize: null }) &&
    isFileValid({ files, field: 'payload[resolutionPlaylistFile]', mimeTypeRegex: null, maxSize: null })
}

function isRunnerJobVODAudioMergeResultPayloadValid (
  _value: VODAudioMergeTranscodingSuccess,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  return type === 'vod-audio-merge-transcoding' &&
    isFileValid({ files, field: 'payload[videoFile]', mimeTypeRegex: null, maxSize: null })
}

function isRunnerJobLiveRTMPHLSResultPayloadValid (
  value: LiveRTMPHLSTranscodingSuccess,
  type: RunnerJobType
) {
  return type === 'live-rtmp-hls-transcoding' && (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}

function isRunnerJobVideoStudioResultPayloadValid (
  _value: VideoStudioTranscodingSuccess,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  return type === 'video-studio-transcoding' &&
    isFileValid({ files, field: 'payload[videoFile]', mimeTypeRegex: null, maxSize: null })
}

function isRunnerJobTranscriptionResultPayloadValid (
  value: TranscriptionSuccess,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  return type === 'video-transcription' &&
    isFileValid({ files, field: 'payload[vttFile]', mimeTypeRegex: null, maxSize: null })
}

// ---------------------------------------------------------------------------

function isRunnerJobVODWebVideoUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  _files: UploadFilesForCheck
) {
  return type === 'vod-web-video-transcoding' &&
    (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}

function isRunnerJobVODHLSUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  _files: UploadFilesForCheck
) {
  return type === 'vod-hls-transcoding' &&
    (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}

function isRunnerJobVODAudioMergeUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  _files: UploadFilesForCheck
) {
  return type === 'vod-audio-merge-transcoding' &&
    (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}

function isRunnerJobTranscriptionUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  _files: UploadFilesForCheck
) {
  return type === 'video-transcription' &&
    (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}

function isRunnerJobLiveRTMPHLSUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  files: UploadFilesForCheck
) {
  let result = type === 'live-rtmp-hls-transcoding' && !!value && !!files

  result &&= isFileValid({ files, field: 'payload[masterPlaylistFile]', mimeTypeRegex: null, maxSize: null, optional: true })

  result &&= isFileValid({
    files,
    field: 'payload[resolutionPlaylistFile]',
    mimeTypeRegex: null,
    maxSize: null,
    optional: !value.resolutionPlaylistFilename
  })

  if (files['payload[resolutionPlaylistFile]']) {
    result &&= isSafeFilename(value.resolutionPlaylistFilename, 'm3u8')
  }

  return result &&
    isSafeFilename(value.videoChunkFilename, 'ts') &&
    (
      (
        value.type === 'remove-chunk'
      ) ||
      (
        value.type === 'add-chunk' &&
        isFileValid({ files, field: 'payload[videoChunkFile]', mimeTypeRegex: null, maxSize: null })
      )
    )
}

function isRunnerJobVideoStudioUpdatePayloadValid (
  value: RunnerJobUpdatePayload,
  type: RunnerJobType,
  _files: UploadFilesForCheck
) {
  return type === 'video-studio-transcoding' &&
    (!value || (typeof value === 'object' && Object.keys(value).length === 0))
}
