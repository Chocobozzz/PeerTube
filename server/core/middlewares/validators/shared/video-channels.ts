import { HttpStatusCode, UserRight, UserRightType } from '@peertube/peertube-models'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MChannelBannerAccountDefault, MChannelUserId, MUserAccountId } from '@server/types/models/index.js'
import express from 'express'
import { checkCanManageAccount } from './users.js'

type CommonOptions = {
  checkCanManage: boolean // Also check the user can manage the account
  checkIsOwner: boolean // Also check this is the owner of the channel
  req: express.Request
  res: express.Response
  specialRight?: UserRightType
}

export async function doesChannelIdExist (
  options: CommonOptions & {
    id: number
    checkIsLocal: boolean // Also check this is a local channel
  }
) {
  const { id, checkCanManage, checkIsLocal, checkIsOwner, req, res, specialRight } = options

  const channel = await VideoChannelModel.loadAndPopulateAccount(+id)

  return processVideoChannelExist({ channel, checkCanManage, checkIsLocal, checkIsOwner, req, res, specialRight })
}

export async function doesChannelHandleExist (
  options: CommonOptions & {
    handle: string
    checkIsLocal: boolean // Also check this is a local channel
  }
) {
  const { handle, checkCanManage, checkIsLocal, checkIsOwner, req, res, specialRight } = options

  const channel = await VideoChannelModel.loadByHandleAndPopulateAccount(handle)

  return processVideoChannelExist({ channel, checkCanManage, checkIsLocal, checkIsOwner, req, res, specialRight })
}

export async function checkCanManageChannel (
  options: CommonOptions & {
    user: MUserAccountId
    channel: MChannelUserId
  }
) {
  const { channel, user, req, res, checkCanManage, checkIsOwner, specialRight = UserRight.MANAGE_ANY_VIDEO_CHANNEL } = options

  if (!channel) {
    res?.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Video channel not found')
    })
    return false
  }

  if (checkIsOwner || checkCanManage) {
    if (!user) {
      res?.fail({
        status: HttpStatusCode.UNAUTHORIZED_401,
        message: req.t('Authentication is required')
      })
      return false
    }

    const isOwner = checkCanManageAccount({
      account: channel.Account,
      user,
      req,
      res: null,
      specialRight
    })

    if (!isOwner) {
      if (checkIsOwner) {
        res?.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: req.t('This user has not owner rights on this channel')
        })

        return false
      }

      if (checkCanManage && !await VideoChannelCollaboratorModel.isCollaborator({ user, channel })) {
        res?.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: req.t('This user cannot manage this channel')
        })
        return false
      }
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function processVideoChannelExist (
  options: CommonOptions & {
    channel: MChannelBannerAccountDefault
    checkIsLocal: boolean // Also check this is a local channel
  }
) {
  const { channel, req, res, checkCanManage, checkIsLocal, checkIsOwner, specialRight = UserRight.MANAGE_ANY_VIDEO_CHANNEL } = options

  const user = res.locals.oauth?.token.User
  if (!await checkCanManageChannel({ channel, user, req, res, checkCanManage, checkIsOwner, specialRight })) return false

  if (checkIsLocal && channel.Actor.isLocal() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('The channel must be local.')
    })

    return false
  }

  res.locals.videoChannel = channel
  return true
}
