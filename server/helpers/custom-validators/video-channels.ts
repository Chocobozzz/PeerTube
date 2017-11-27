import * as Bluebird from 'bluebird'
import * as express from 'express'
import 'express-validator'
import 'multer'
import * as validator from 'validator'

import { CONSTRAINTS_FIELDS, database as db } from '../../initializers'
import { VideoChannelInstance } from '../../models'
import { logger } from '../logger'
import { isActivityPubUrlValid } from './index'
import { exists } from './misc'

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

function checkVideoChannelExists (id: string, res: express.Response, callback: () => void) {
  let promise: Bluebird<VideoChannelInstance>
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

async function isVideoChannelExistsPromise (id: string, res: express.Response) {
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
  checkVideoChannelExists,
  isVideoChannelNameValid,
  isVideoChannelExistsPromise,
  isVideoChannelUrlValid
}
