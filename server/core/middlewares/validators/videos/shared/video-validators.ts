import { canVideoFileBeEdited } from '@peertube/peertube-core-utils'
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
  req: express.Request
  res: express.Response
  user: MUserAccountId
  videoFileSize: number
  files: express.UploadFilesForCheck
}): Promise<boolean> {
  const { req, res, user, videoFileSize, files } = options

  if (!isVideoFileMimeTypeValid(files)) {
    res.fail({
      status: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415,
      message: req.t(
        'This file is not supported. Please, make sure it is of the following type: {types}',
        { types: CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ') }
      )
    })
    return false
  }

  if (!isVideoFileSizeValid(videoFileSize.toString())) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: req.t('This file is too large. It exceeds the maximum file size authorized'),
      type: ServerErrorCode.MAX_FILE_SIZE_REACHED
    })
    return false
  }

  if (await checkUserQuota({ user, videoFileSize, req, res }) === false) return false

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

  if (acceptedResult?.accepted !== true) {
    logger.info('Refused local video file.', { acceptedResult, acceptParameters })
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || req.t('Refused local video file')
    })
    return false
  }

  return true
}

export function checkVideoFileCanBeEdited (video: MVideo, req: express.Request, res: express.Response) {
  if (video.isLive) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot edit a live video')
    })

    return false
  }

  if (video.state === VideoState.TO_TRANSCODE || video.state === VideoState.TO_EDIT) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('Cannot edit video that is already waiting for transcoding/edition')
    })

    return false
  }

  if (!canVideoFileBeEdited(video.state)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Video state is not compatible with edition')
    })

    return false
  }

  return true
}

export function checkVideoCanBeTranscribed (video: MVideo, req: express.Request, res: express.Response) {
  if (video.remote) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot run this task on a remote video')
    })
    return false
  }

  if (video.isLive) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot run this task on a live video')
    })
    return false
  }

  const incompatibleStates = new Set<VideoStateType>([
    VideoState.TO_IMPORT,
    VideoState.TO_EDIT,
    VideoState.TO_MOVE_TO_EXTERNAL_STORAGE,
    VideoState.TO_MOVE_TO_FILE_SYSTEM,
    VideoState.TO_IMPORT_FAILED
  ])
  if (incompatibleStates.has(video.state)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot run this task on a video with "{state}" state', { state: VIDEO_STATES[video.state] })
    })
    return false
  }

  return true
}
