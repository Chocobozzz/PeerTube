import * as Promise from 'bluebird'
import * as validator from 'validator'
import * as express from 'express'
import 'express-validator'
import 'multer'

import { database as db, CONSTRAINTS_FIELDS } from '../../initializers'
import { VideoChannelInstance } from '../../models'
import { logger } from '../logger'
import { exists } from './misc'
import { isActivityPubUrlValid } from './index'

const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_CHANNELS

function isVideoChannelUrlValid (value: string) {
  return isActivityPubUrlValid(value)
}

function isVideoChannelDescriptionValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoChannelNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoChannelUUIDValid (value: string) {
  return exists(value) && validator.isUUID('' + value, 4)
}

function checkVideoChannelExists (id: string, res: express.Response, callback: () => void) {
  let promise: Promise<VideoChannelInstance>
  if (validator.isInt(id)) {
    promise = db.VideoChannel.loadAndPopulateAccount(+id)
  } else { // UUID
    promise = db.VideoChannel.loadByUUIDAndPopulateAccount(id)
  }

  promise.then(videoChannel => {
    if (!videoChannel) {
      return res.status(404)
        .json({ error: 'Video channel not found' })
        .end()
    }

    res.locals.videoChannel = videoChannel
    callback()
  })
    .catch(err => {
      logger.error('Error in video channel request validator.', err)
      return res.sendStatus(500)
    })
}

// ---------------------------------------------------------------------------

export {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelUUIDValid,
  checkVideoChannelExists,
  isVideoChannelUrlValid
}
