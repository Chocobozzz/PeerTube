import express from 'express'
import { getVideoWithAttributes } from '@server/helpers/video'
import { VideoSourceModel } from '@server/models/video/video-source'
import { MVideoFullLight } from '@server/types/models'
import { HttpStatusCode, UserRight } from '@shared/models'
import { areValidationErrors, checkUserCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoSourceGetValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res, 'for-api')) return

    const video = getVideoWithAttributes(res) as MVideoFullLight

    res.locals.videoSource = await VideoSourceModel.loadByVideoId(video.id)
    if (!res.locals.videoSource) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video source not found'
      })
    }

    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

export {
  videoSourceGetValidator
}
