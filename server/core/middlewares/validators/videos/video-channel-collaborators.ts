import { HttpStatusCode, UserRight, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import express from 'express'
import { body, param } from 'express-validator'
import { areValidationErrors, checkCanManageAccount, doesAccountHandleExist, doesChannelHandleExist } from '../shared/index.js'

export const channelListCollaboratorsValidator = [
  param('handle').exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: true, checkIsLocal: true, checkIsOwner: false, req, res })
    ) return

    return next()
  }
]

export const channelInviteCollaboratorsValidator = [
  param('handle').exists(),

  body('accountHandle').exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: true, checkIsLocal: true, checkIsOwner: true, req, res })
    ) {
      return
    }

    if (!await doesAccountHandleExist({ handle: req.body.accountHandle, req, res, checkIsLocal: true, checkCanManage: false })) return

    const collaborator = await VideoChannelCollaboratorModel.loadByCollaboratorAccountName(req.body.accountHandle)
    if (collaborator) {
      res.fail({
        message: req.t('This account is already a collaborator or has a pending invitation for this channel'),
        status: HttpStatusCode.BAD_REQUEST_400
      })
      return
    }

    return next()
  }
]

export const channelAcceptOrRejectInviteCollaboratorsValidator = [
  param('handle').exists(),
  param('collaboratorId').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: false, checkIsLocal: true, checkIsOwner: false, req, res })
    ) {
      return
    }

    if (!await doesChannelCollaboratorExist({ collaboratorId: +req.params.collaboratorId, req, res })) return

    const channelCollaborator = await VideoChannelCollaboratorModel.load(+req.params.collaboratorId)
    if (!channelCollaborator) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (channelCollaborator.state !== VideoChannelCollaboratorState.PENDING) {
      res.fail({ message: req.t('Collaborator is not in pending state') })
      return
    }

    const user = res.locals.oauth.token.User
    if (channelCollaborator.accountId !== user.Account.id) {
      res.fail({ message: req.t('Collaborator is not the current user') })
      return
    }

    return next()
  }
]

export const channelDeleteInviteCollaboratorsValidator = [
  param('handle').exists(),
  param('collaboratorId').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesChannelCollaboratorExist({ collaboratorId: +req.params.collaboratorId, req, res })) return

    const user = res.locals.oauth.token.User

    const canManageCollaboratorAccount = checkCanManageAccount({
      user,
      account: res.locals.channelCollaborator.Account,
      req,
      res,
      specialRight: UserRight.MANAGE_ANY_VIDEO_CHANNEL
    })

    // Check this is the owner of the channel if the user is not the collaborator account
    // Only the owner and the collaborator can delete the collaboration
    const checkIsOwner = !canManageCollaboratorAccount

    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: true, checkIsLocal: true, checkIsOwner, req, res })
    ) {
      return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function doesChannelCollaboratorExist (options: {
  collaboratorId: number
  req: express.Request
  res: express.Response
}) {
  const { collaboratorId, req, res } = options

  const channelCollaborator = await VideoChannelCollaboratorModel.load(collaboratorId)
  if (!channelCollaborator) {
    res.fail({
      message: req.t('Channel collaborator does not exist'),
      status: HttpStatusCode.NOT_FOUND_404
    })
    return false
  }

  res.locals.channelCollaborator = channelCollaborator

  return true
}
