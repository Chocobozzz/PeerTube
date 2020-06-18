import { Response } from 'express'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { MVideoId } from '@server/types/models'

async function doesVideoCaptionExist (video: MVideoId, language: string, res: Response) {
  const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language)

  if (!videoCaption) {
    res.status(404)
       .json({ error: 'Video caption not found' })
       .end()

    return false
  }

  res.locals.videoCaption = videoCaption
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoCaptionExist
}
