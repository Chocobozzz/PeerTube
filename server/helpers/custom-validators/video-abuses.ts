import { Response } from 'express'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers'
import { exists } from './misc'
import { VideoAbuseModel } from '../../models/video/video-abuse'

const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbuseModerationCommentValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT)
}

function isVideoAbuseStateValid (value: string) {
  return exists(value) && VIDEO_ABUSE_STATES[ value ] !== undefined
}

async function isVideoAbuseExist (abuseId: number, videoId: number, res: Response) {
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
  isVideoAbuseExist,
  isVideoAbuseStateValid,
  isVideoAbuseReasonValid,
  isVideoAbuseModerationCommentValid
}
