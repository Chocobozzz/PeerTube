import express from 'express'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MChannelBannerAccountDefault } from '@server/types/models/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'

async function doesVideoChannelIdExist (id: number, res: express.Response) {
  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(+id)

  return processVideoChannelExist(videoChannel, res)
}

async function doesVideoChannelNameWithHostExist (nameWithDomain: string, res: express.Response) {
  const videoChannel = await VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithDomain)

  return processVideoChannelExist(videoChannel, res)
}

// ---------------------------------------------------------------------------

export {
  doesVideoChannelIdExist,
  doesVideoChannelNameWithHostExist
}

function processVideoChannelExist (videoChannel: MChannelBannerAccountDefault, res: express.Response) {
  if (!videoChannel) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video channel not found'
    })
    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}
