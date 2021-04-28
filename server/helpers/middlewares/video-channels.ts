import * as express from 'express'
import { MChannelBannerAccountDefault } from '@server/types/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { VideoChannelModel } from '../../models/video/video-channel'

async function doesLocalVideoChannelNameExist (name: string, res: express.Response, sendNotFound = true) {
  const videoChannel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(name)

  return processVideoChannelExist(videoChannel, res, sendNotFound)
}

async function doesVideoChannelIdExist (id: number, res: express.Response, sendNotFound = true) {
  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(+id)

  return processVideoChannelExist(videoChannel, res, sendNotFound)
}

async function doesVideoChannelNameWithHostExist (nameWithDomain: string, res: express.Response, sendNotFound = true) {
  const videoChannel = await VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithDomain)

  return processVideoChannelExist(videoChannel, res, sendNotFound)
}

// ---------------------------------------------------------------------------

export {
  doesLocalVideoChannelNameExist,
  doesVideoChannelIdExist,
  doesVideoChannelNameWithHostExist
}

function processVideoChannelExist (videoChannel: MChannelBannerAccountDefault, res: express.Response, sendNotFound = true) {
  if (!videoChannel) {
    if (sendNotFound) {
      res.status(HttpStatusCode.NOT_FOUND_404)
        .json({ error: 'Video channel not found' })
    }

    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}
