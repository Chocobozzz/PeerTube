import express from 'express'
import { isVideoFileMimeTypeValid, isVideoFileSizeValid } from '@server/helpers/custom-validators/videos'
import { logger } from '@server/helpers/logger'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants'
import { isLocalVideoFileAccepted } from '@server/lib/moderation'
import { Hooks } from '@server/lib/plugins/hooks'
import { MUserAccountId, MVideo } from '@server/types/models'
import { HttpStatusCode, ServerErrorCode, ServerFilterHookName, VideoState } from '@shared/models'
import { checkUserQuota } from '../../shared'

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
      message: 'This file is not supported. Please, make sure it is of the following type: ' +
               CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
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
  videoFile: express.VideoUploadFile
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

  const validStates = new Set([ VideoState.PUBLISHED, VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED, VideoState.TRANSCODING_FAILED ])
  if (!validStates.has(video.state)) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Video state is not compatible with edition'
    })

    return false
  }

  return true
}
