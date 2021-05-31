import { Response } from 'express'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

async function doesVideoBlacklistExist (videoId: number, res: Response) {
  const videoBlacklist = await VideoBlacklistModel.loadByVideoId(videoId)

  if (videoBlacklist === null) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Blacklisted video not found'
    })
    return false
  }

  res.locals.videoBlacklist = videoBlacklist
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoBlacklistExist
}
