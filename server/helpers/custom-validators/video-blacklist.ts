import { Response } from 'express'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'

const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_BLACKLIST

function isVideoBlacklistReasonValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON)
}

async function isVideoBlacklistExist (videoId: number, res: Response) {
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
  isVideoBlacklistReasonValid,
  isVideoBlacklistExist
}
