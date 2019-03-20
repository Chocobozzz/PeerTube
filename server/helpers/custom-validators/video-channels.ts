import * as express from 'express'
import 'express-validator'
import 'multer'
import * as validator from 'validator'
import { CONFIG, CONSTRAINTS_FIELDS } from '../../initializers'
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

async function doesLocalVideoChannelNameExist (name: string, res: express.Response) {
  const videoChannel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(name)

  return processVideoChannelExist(videoChannel, res)
}

async function doesVideoChannelIdExist (id: number | string, res: express.Response) {
  let videoChannel: VideoChannelModel
  if (validator.isInt('' + id)) {
    videoChannel = await VideoChannelModel.loadAndPopulateAccount(+id)
  } else { // UUID
    videoChannel = await VideoChannelModel.loadByUUIDAndPopulateAccount('' + id)
  }

  return processVideoChannelExist(videoChannel, res)
}

async function doesVideoChannelNameWithHostExist (nameWithDomain: string, res: express.Response) {
  const videoChannel = await VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithDomain)

  return processVideoChannelExist(videoChannel, res)
}

// ---------------------------------------------------------------------------

export {
  doesVideoChannelNameWithHostExist,
  doesLocalVideoChannelNameExist,
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid,
  doesVideoChannelIdExist
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
