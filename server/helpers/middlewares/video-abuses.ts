import { Response } from 'express'
import { VideoAbuseModel } from '../../models/video/video-abuse'

async function doesVideoAbuseExist (abuseId: number, videoId: number, res: Response) {
  const videoAbuse = await VideoAbuseModel.loadByIdAndVideoId(abuseId, videoId)

  if (videoAbuse === null) {
    res.status(404)
       .json({ error: 'Video abuse not found' })
       .end()

    return false
  }

  res.locals.videoAbuse = videoAbuse
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoAbuseExist
}
