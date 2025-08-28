import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MChannelBannerAccountDefault } from '@server/types/models/index.js'
import express from 'express'
import { checkUserCanManageAccount } from './users.js'

export async function doesChannelIdExist (options: {
  id: number
  checkManage: boolean // Also check the user can manage the account
  checkIsLocal: boolean // Also check this is a local channel
  req: express.Request
  res: express.Response
}) {
  const { id, checkManage, checkIsLocal, req, res } = options

  const channel = await VideoChannelModel.loadAndPopulateAccount(+id)

  return processVideoChannelExist({ channel, checkManage, checkIsLocal, req, res })
}

export async function doesChannelHandleExist (options: {
  handle: string
  checkManage: boolean // Also check the user can manage the account
  checkIsLocal: boolean // Also check this is a local channel
  req: express.Request
  res: express.Response
}) {
  const { handle, checkManage, checkIsLocal, req, res } = options

  const channel = await VideoChannelModel.loadByHandleAndPopulateAccount(handle)

  return processVideoChannelExist({ channel, checkManage, checkIsLocal, req, res })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function processVideoChannelExist (options: {
  channel: MChannelBannerAccountDefault
  req: express.Request
  res: express.Response
  checkManage: boolean
  checkIsLocal: boolean
}) {
  const { channel, req, res, checkManage, checkIsLocal } = options

  if (!channel) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Video channel not found')
    })
    return false
  }

  if (checkManage) {
    const user = res.locals.oauth.token.User

    if (!checkUserCanManageAccount({ account: channel.Account, user, req, res, specialRight: UserRight.MANAGE_ANY_VIDEO_CHANNEL })) {
      return false
    }
  }

  if (checkIsLocal && channel.Actor.isOwned() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('This channel is not owned.')
    })

    return false
  }

  res.locals.videoChannel = channel
  return true
}
