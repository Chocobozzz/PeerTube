import { UploadFilesForCheck } from 'express'
import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants'
import {
  LiveRTMPHLSTranscodingSuccess,
  RunnerJobSuccessPayload,
  RunnerJobType,
  RunnerJobUpdatePayload,
  VideoStudioTranscodingSuccess,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess
} from '@shared/models'
import { exists, isFileValid, isSafeFilename } from '../misc'

const RUNNER_JOBS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.RUNNER_JOBS

const runnerJobTypes = new Set([ 'vod-hls-transcoding', 'vod-web-video-transcoding', 'vod-audio-merge-transcoding' ])
function isRunnerJobTypeValid (value: RunnerJobType) {
  return runnerJobTypes.has(value)
}

function isRunnerJobSuccessPayloadValid (value: RunnerJobSuccessPayload, type: RunnerJobType, files: UploadFilesForCheck) {
  return isRunnerJobVODWebVideoResultPayloadValid(value as VODWebVideoTranscodingSuccess, type, files) ||
    isRunnerJobVODHLSResultPayloadValid(value as VODHLSTranscodingSuccess, type, files) ||
    isRunnerJobVODAudioMergeResultPayloadValid(value as VODHLSTranscodingSuccess, type, files) ||
    isRunnerJobLiveRTMPHLSResultPayloadValid(value as LiveRTMPHLSTranscodingSuccess, type) ||
    isRunnerJobVideoStudioResultPayloadValid(value as VideoStudioTranscodingSuccess, type, files)
}

// ---------------------------------------------------------------------------

function isRunnerJobProgressValid (value: string) {
  return validator.isInt(value + '', RUNNER_JOBS_CONSTRAINTS_FIELDS.PROGRESS)
}

function isRunnerJobUpdatePayloadValid (value: RunnerJobUpdatePayload, type: RunnerJobType, files: UploadFilesForCheck) {
  return isRunnerJobVODWebVideoUpdatePayloadValid(value, type, files) ||
    isRunnerJobVODHLSUpdatePayloadValid(value, type, files) ||
    isRunnerJobVideoStudioUpdatePayloadValid(value, type, files) ||
    isRunnerJobVODAudioMergeUpdatePayloadValid(value, type, files) ||
    isRunnerJobLiveRTMPHLSUpdatePayloadValid(value, type, files)
}

// ---------------------------------------------------------------------------

function isRunnerJobTokenValid (value: string) {
  return exists(value) && validator.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.TOKEN)
}

function isRunnerJobAbortReasonValid (value: string) {
  return validator.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.REASON)
}

function isRunnerJobErrorMessageValid (value: string) {
  return validator.isLength(value, RUNNER_JOBS_CONSTRAINTS_FIELDS.ERROR_MESSAGE)
}

// ---------------------------------------------------------------------------

export {
  isRunnerJobTypeValid,
  isRunnerJobSuccessPayloadValid,
  isRunnerJobUpdatePayloadValid,
  isRunnerJobTokenValid,
  isRunnerJobErrorMessageValid,
  isRunnerJobProgressValid,
  isRunnerJobAbortReasonValid
}

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
