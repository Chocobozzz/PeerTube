import { VideoModel } from '../../models/video/video'
import { Response } from 'express'
import { VideoCaptionModel } from '../../models/video/video-caption'

async function doesVideoCaptionExist (video: VideoModel, language: string, res: Response) {
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
