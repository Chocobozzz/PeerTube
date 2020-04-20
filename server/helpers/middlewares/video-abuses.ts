import { Response } from 'express'
import { VideoAbuseModel } from '../../models/video/video-abuse'
import { fetchVideo } from '../video'

async function doesVideoAbuseExist (abuseIdArg: number | string, videoUUID: string, res: Response) {
  const abuseId = parseInt(abuseIdArg + '', 10)
  let videoAbuse = await VideoAbuseModel.loadByIdAndVideoId(abuseId, null, videoUUID)

  if (!videoAbuse) {
    const userId = res.locals.oauth?.token.User.id
    const video = await fetchVideo(videoUUID, 'all', userId)

    if (video) videoAbuse = await VideoAbuseModel.loadByIdAndVideoId(abuseId, video.id)
  }

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
