import { Response } from 'express'
import * as validator from 'validator'
import { exists } from './misc'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'
import { VideoBlacklistType } from '../../../shared/models/videos'

const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_BLACKLIST

function isVideoBlacklistReasonValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON)
}

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

function isVideoBlacklistTypeValid (value: any) {
  return exists(value) && validator.isInt('' + value) && VideoBlacklistType[value] !== undefined
}

// ---------------------------------------------------------------------------

export {
  isVideoBlacklistReasonValid,
  isVideoBlacklistTypeValid,
  doesVideoBlacklistExist
}
