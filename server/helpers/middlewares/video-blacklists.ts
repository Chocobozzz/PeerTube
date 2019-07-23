import { Response } from 'express'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'

async function doesVideoBlacklistExist (videoId: number, res: Response) {
  const videoBlacklist = await VideoBlacklistModel.loadByVideoId(videoId)

  if (videoBlacklist === null) {
    res.status(404)
       .json({ error: 'Blacklisted video not found' })
       .end()

    return false
  }

  res.locals.videoBlacklist = videoBlacklist
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoBlacklistExist
}
