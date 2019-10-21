import { Response } from 'express'
import { VideoAbuseModel } from '../../models/video/video-abuse'

async function doesVideoAbuseExist (abuseIdArg: number | string, videoId: number, res: Response) {
  const abuseId = parseInt(abuseIdArg + '', 10)
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
