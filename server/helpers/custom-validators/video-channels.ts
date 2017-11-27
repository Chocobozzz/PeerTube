import * as express from 'express'
import 'express-validator'
import 'multer'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, database as db } from '../../initializers'
import { VideoChannelInstance } from '../../models'
import { exists } from './misc'

const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_CHANNELS

function isVideoChannelDescriptionValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoChannelNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME)
}

async function isVideoChannelExist (id: string, res: express.Response) {
  let videoChannel: VideoChannelInstance
  if (validator.isInt(id)) {
    videoChannel = await db.VideoChannel.loadAndPopulateAccount(+id)
  } else { // UUID
    videoChannel = await db.VideoChannel.loadByUUIDAndPopulateAccount(id)
  }

  if (!videoChannel) {
    res.status(404)
      .json({ error: 'Video channel not found' })
      .end()

    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelExist
}
