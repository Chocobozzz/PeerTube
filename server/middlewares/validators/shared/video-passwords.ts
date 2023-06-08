import express from 'express'
import { MVideo, MVideoId, MVideoPassword } from '@server/types/models'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import { forceNumber } from '@shared/core-utils'
import { VideoPasswordModel } from '@server/models/video/video-password'
import { header } from 'express-validator'

function isValidVideoPasswordHeader () {
  return header('x-peertube-video-password')
    .optional()
    .isString()
}

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
  const videoPassword = await VideoPasswordModel.loadByIdAndVideo({ id, videoId: video.id })

  if (!videoPassword) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video password not found'
    })
    return false
  }

  res.locals.videoPassword = videoPassword

  return true
}

async function isVideoPasswordDeletable (password: MVideoPassword, video: MVideoId, res: express.Response) {
  const passwords = await VideoPasswordModel.loadByVideoId(video.id)

  if (passwords.length <= 1) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Cannot delete the last password of the protected video'
    })
    return false
  }

  return true
}

export {
  isValidVideoPasswordHeader,
  isVideoPasswordProtected,
  doesVideoPasswordExist,
  isVideoPasswordDeletable
}
