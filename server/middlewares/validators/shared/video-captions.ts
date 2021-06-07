import { Response } from 'express'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { MVideoId } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'

async function doesVideoCaptionExist (video: MVideoId, language: string, res: Response) {
  const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language)

  if (!videoCaption) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video caption not found'
    })
    return false
  }

  res.locals.videoCaption = videoCaption
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoCaptionExist
}
