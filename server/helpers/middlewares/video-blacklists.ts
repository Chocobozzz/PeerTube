import { Response } from 'express'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

async function doesVideoBlacklistExist (videoId: number, res: Response) {
  const videoBlacklist = await VideoBlacklistModel.loadByVideoId(videoId)

  if (videoBlacklist === null) {
    res.status(HttpStatusCode.NOT_FOUND_404)
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
