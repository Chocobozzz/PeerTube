import express from 'express'
import { MVideo, MVideoId, MVideoPassword } from '@server/types/models'
import { HttpStatusCode, ServerErrorCode, VideoPrivacy } from '@shared/models'
import { forceNumber } from '@shared/core-utils'
import { VideoPasswordModel } from '@server/models/video/video-password'
import { logger } from '@server/helpers/logger'

function isVideoPasswordProtected (video: MVideo, res: express.Response) {
  if (video.privacy !== VideoPrivacy.PASSWORD_PROTECTED) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Video is not password protected'
    })
    return false
  }

  return true
}

async function doesVideoPasswordExist (idArg: number | string, video: MVideoId, res: express.Response) {
  const id = forceNumber(idArg)
  const videoPassword = await VideoPasswordModel.loadById(id)

  if (!videoPassword) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video password not found'
    })
    return false
  }

  if (videoPassword.videoId !== video.id) {
    res.fail({
      type: ServerErrorCode.PASSWORD_NOT_ASSOCIATED_TO_VIDEO,
      message: 'Video password is not associated to this video.'
    })
    return false
  }
  res.locals.videoPassword = videoPassword
  logger.error(JSON.stringify(res.locals.videoPassword) + '\n\n\n\n hello 1')
  return true
}

async function isVideoPasswordDeletable (password: MVideoPassword, video: MVideoId, res: express.Response) {
  const passwords = await VideoPasswordModel.loadByVideoId(video.id)

  if (passwords.length <= 1) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot delete the last password of the protected video'
    })
    return false
  }

  logger.error(JSON.stringify(res.locals.videoPassword) + '\n\n\n\n hello 2')
  return true
}

export {
  isVideoPasswordProtected,
  doesVideoPasswordExist,
  isVideoPasswordDeletable
}
