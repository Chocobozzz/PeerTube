import { HttpStatusCode, ServerErrorCode, ServerFilterHookName, VideoState, VideoStateType } from '@peertube/peertube-models'
import { isVideoFileMimeTypeValid, isVideoFileSizeValid } from '@server/helpers/custom-validators/videos.js'
import { logger } from '@server/helpers/logger.js'
import { CONSTRAINTS_FIELDS, VIDEO_STATES } from '@server/initializers/constants.js'
import { isLocalVideoFileAccepted } from '@server/lib/moderation.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { MUserAccountId, MVideo } from '@server/types/models/index.js'
import express from 'express'
import { checkUserQuota } from '../../shared/index.js'

export async function commonVideoFileChecks (options: {
  res: express.Response
  user: MUserAccountId
  videoFileSize: number
  files: express.UploadFilesForCheck
}): Promise<boolean> {
  const { res, user, videoFileSize, files } = options

  if (!isVideoFileMimeTypeValid(files)) {
    res.fail({
      status: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415,
      message: `This file is not supported. Please, make sure it is of the following type: ${CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')}`
    })
    return false
  }

  if (!isVideoFileSizeValid(videoFileSize.toString())) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'This file is too large. It exceeds the maximum file size authorized.',
      type: ServerErrorCode.MAX_FILE_SIZE_REACHED
    })
    return false
  }

  if (await checkUserQuota(user, videoFileSize, res) === false) return false

  return true
}

export async function isVideoFileAccepted (options: {
  req: express.Request
  res: express.Response
  videoFile: express.VideoLegacyUploadFile
  hook: Extract<ServerFilterHookName, 'filter:api.video.upload.accept.result' | 'filter:api.video.update-file.accept.result'>
}) {
  const { req, res, videoFile, hook } = options

  // Check we accept this video
  const acceptParameters = {
    videoBody: req.body,
    videoFile,
    user: res.locals.oauth.token.User
  }
  const acceptedResult = await Hooks.wrapFun(isLocalVideoFileAccepted, acceptParameters, hook)

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused local video file.', { acceptedResult, acceptParameters })
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || 'Refused local video file'
    })
    return false
  }

  return true
}

export function checkVideoFileCanBeEdited (video: MVideo, res: express.Response) {
  if (video.isLive) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Cannot edit a live video'
    })

    return false
  }

  if (video.state === VideoState.TO_TRANSCODE || video.state === VideoState.TO_EDIT) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Cannot edit video that is already waiting for transcoding/edition'
    })

    return false
  }

  const validStates = new Set<VideoStateType>([
    VideoState.PUBLISHED,
    VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED,
    VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED,
    VideoState.TRANSCODING_FAILED
  ])

  if (!validStates.has(video.state)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Video state is not compatible with edition'
    })

    return false
  }

  return true
}

export function checkVideoCanBeTranscribedOrTranscripted (video: MVideo, res: express.Response) {
  if (video.remote) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Cannot run this task on a remote video'
    })
    return false
  }

  if (video.isLive) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Cannot run this task on a live'
    })
    return false
  }

  const incompatibleStates = new Set<VideoStateType>([
    VideoState.TO_IMPORT,
    VideoState.TO_EDIT,
    VideoState.TO_MOVE_TO_EXTERNAL_STORAGE,
    VideoState.TO_MOVE_TO_FILE_SYSTEM
  ])
  if (incompatibleStates.has(video.state)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: `Cannot run this task on a video with "${VIDEO_STATES[video.state]}" state`
    })
    return false
  }

  return true
}
