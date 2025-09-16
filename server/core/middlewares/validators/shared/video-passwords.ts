import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoPrivacy } from '@peertube/peertube-models'
import { getVideoWithAttributes } from '@server/helpers/video.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { MUserAccountId, MVideoAccountLight } from '@server/types/models/index.js'
import express from 'express'
import { header } from 'express-validator'
import { checkCanManageVideo } from './videos.js'

export function isValidVideoPasswordHeader () {
  return header('x-peertube-video-password')
    .optional()
    .isString()
}

export function checkVideoIsPasswordProtected (req: express.Request, res: express.Response) {
  const video = getVideoWithAttributes(res)
  if (video.privacy !== VideoPrivacy.PASSWORD_PROTECTED) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Video is not password protected')
    })
    return false
  }

  return true
}

export async function doesVideoPasswordExist (options: {
  id: number | string
  req: express.Request
  res: express.Response
}) {
  const { req, res } = options

  const video = getVideoWithAttributes(res)
  const id = forceNumber(options.id)
  const videoPassword = await VideoPasswordModel.loadByIdAndVideo({ id, videoId: video.id })

  if (!videoPassword) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Video password not found')
    })
    return false
  }

  res.locals.videoPassword = videoPassword

  return true
}

export async function checkCanDeleteVideoPassword (options: {
  user: MUserAccountId
  video: MVideoAccountLight
  req: express.Request
  res: express.Response
}) {
  const { user, video, req, res } = options

  const passwordCount = await VideoPasswordModel.countByVideoId(video.id)

  if (passwordCount <= 1) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('Cannot delete the last password of the protected video')
    })
    return false
  }

  return checkCanManageVideo({ user, video, right: UserRight.UPDATE_ANY_VIDEO, req, res, checkIsLocal: true, checkIsOwner: false })
}
