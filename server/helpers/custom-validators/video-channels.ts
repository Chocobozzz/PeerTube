import * as express from 'express'
import 'express-validator'
import 'multer'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { VideoChannelModel } from '../../models/video/video-channel'
import { exists } from './misc'

const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_CHANNELS

function isVideoChannelDescriptionValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoChannelNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoChannelSupportValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT))
}

// ---------------------------------------------------------------------------

export {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid,
}

function processVideoChannelExist (videoChannel: VideoChannelModel, res: express.Response) {
  if (!videoChannel) {
    res.status(404)
       .json({ error: 'Video channel not found' })
       .end()

    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}
