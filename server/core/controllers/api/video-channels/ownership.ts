import { ChangeOwnershipState, ChangeOwnershipStateType, HttpStatusCode, VideoChannelActivityAction } from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import express from 'express'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { sendUpdateActor } from '../../../lib/activitypub/send/index.js'
import { Notifier } from '../../../lib/notifier/notifier.js'
import {
  acceptChannelChangeOwnershipValidator,
  acceptOrRejectChangeOwnershipValidatorFactory,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  changeChannelOwnershipValidator,
  changeOwnershipSortValidator,
  deleteChangeChannelOwnershipValidator,
  listChannelOwnershipChangesValidator,
  paginationValidator,
  setDefaultPagination
} from '../../../middlewares/index.js'
import { ChangeOwnershipModel } from '../../../models/video/change-ownership.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'

const ownershipChannelRouter = express.Router()

ownershipChannelRouter.post(
  '/:handle/give-ownership',
  authenticate,
  asyncMiddleware(changeChannelOwnershipValidator),
  asyncRetryTransactionMiddleware(createChangeOwnershipRequest)
)

ownershipChannelRouter.get(
  '/:handle/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  changeOwnershipSortValidator,
  asyncMiddleware(listChannelOwnershipChangesValidator),
  asyncRetryTransactionMiddleware(listChannelOwnershipChanges)
)

ownershipChannelRouter.get(
  '/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  changeOwnershipSortValidator,
  asyncRetryTransactionMiddleware(listAccountChannelOwnershipChanges)
)

ownershipChannelRouter.post(
  '/ownership/:id/accept',
  authenticate,
  asyncMiddleware(acceptOrRejectChangeOwnershipValidatorFactory('channel')),
  asyncMiddleware(acceptChannelChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(acceptOwnershipChange)
)

ownershipChannelRouter.post(
  '/ownership/:id/refuse',
  authenticate,
  asyncMiddleware(acceptOrRejectChangeOwnershipValidatorFactory('channel')),
  asyncRetryTransactionMiddleware(refuseOwnershipChange)
)

ownershipChannelRouter.delete(
  '/ownership/:id',
  authenticate,
  asyncMiddleware(deleteChangeChannelOwnershipValidator),
  asyncRetryTransactionMiddleware(deleteOwnershipChange)
)

// ---------------------------------------------------------------------------

export {
  ownershipChannelRouter
}

// ---------------------------------------------------------------------------

async function createChangeOwnershipRequest (req: express.Request, res: express.Response) {
  const channel = res.locals.videoChannel
  const initiatorAccountId = res.locals.oauth.token.User.Account.id
  const nextOwner = res.locals.changeOwnershipNextOwner

  const ownershipChange = await sequelizeTypescript.transaction(async t => {
    const ownershipChange = await ChangeOwnershipModel.create({
      initiatorAccountId,
      nextOwnerAccountId: nextOwner.id,
      videoChannelId: channel.id,
      state: ChangeOwnershipState.PENDING
    }, { transaction: t })

    await VideoChannelActivityModel.addChannelOwnershipChangeActivity({
      action: VideoChannelActivityAction.SEND_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel: channel,
      targetAccount: nextOwner,
      transaction: t
    })

    return ownershipChange
  })

  const ownershipChangeFull = await ChangeOwnershipModel.load(ownershipChange.id)

  Notifier.Instance.notifyOfRequestedChannelOwnershipChange(ownershipChangeFull)

  logger.info('Ownership change for channel %s created.', channel.Actor.preferredUsername)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listChannelOwnershipChanges (req: express.Request, res: express.Response) {
  const videoChannelId = res.locals.videoChannel.id
  const state = req.query.state as ChangeOwnershipStateType

  const resultList = await ChangeOwnershipModel.listForChannelApi({
    videoChannelId,
    state,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort || 'createdAt'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountChannelOwnershipChanges (req: express.Request, res: express.Response) {
  const currentAccountId = getAuthUser(res).Account.id

  const resultList = await ChangeOwnershipModel.listForChannelApi({
    accountId: currentAccountId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort || 'createdAt'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function acceptOwnershipChange (req: express.Request, res: express.Response) {
  await sequelizeTypescript.transaction(async t => {
    const changeOwnership = res.locals.changeOwnership
    const channel = await VideoChannelModel.load(changeOwnership.VideoChannel.id, t)
    const previousOwnerId = channel.accountId

    channel.accountId = changeOwnership.NextOwner.id
    await channel.save({ transaction: t })

    // Update owner of channel playlists
    await VideoPlaylistModel.updateOwnerOfChannelPlaylists({
      currentOwnerId: previousOwnerId,
      nextOwnerId: changeOwnership.NextOwner.id,
      videoChannelId: channel.id,
      transaction: t
    })

    // Remove collaborator if the next owner is a collaborator of the channel
    const collaborator = await VideoChannelCollaboratorModel.loadByCollaboratorAccountName({
      accountName: changeOwnership.NextOwner.Actor.preferredUsername,
      channelId: channel.id,
      transaction: t
    })
    if (collaborator) await collaborator.destroy({ transaction: t })

    const channelFull = await VideoChannelModel.loadAndPopulateAccount(channel.id, t)
    await sendUpdateActor(channelFull, t)

    changeOwnership.state = ChangeOwnershipState.ACCEPTED
    await changeOwnership.save({ transaction: t })

    await VideoChannelActivityModel.addChannelOwnershipChangeActivity({
      action: VideoChannelActivityAction.ACCEPT_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel: channelFull,
      targetAccount: changeOwnership.NextOwner,
      transaction: t
    })

    Notifier.Instance.notifyOfAcceptedChannelOwnershipChange(changeOwnership)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function refuseOwnershipChange (req: express.Request, res: express.Response) {
  await sequelizeTypescript.transaction(async t => {
    const changeOwnership = res.locals.changeOwnership

    changeOwnership.state = ChangeOwnershipState.REJECTED
    await changeOwnership.save({ transaction: t })

    const channel = await VideoChannelModel.loadAndPopulateAccount(changeOwnership.videoChannelId, t)

    await VideoChannelActivityModel.addChannelOwnershipChangeActivity({
      action: VideoChannelActivityAction.REFUSE_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel,
      targetAccount: changeOwnership.NextOwner,
      transaction: t
    })

    Notifier.Instance.notifyOfRejectedChannelOwnershipChange(changeOwnership)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteOwnershipChange (req: express.Request, res: express.Response) {
  await sequelizeTypescript.transaction(async t => {
    const changeOwnership = res.locals.changeOwnership
    const channel = await VideoChannelModel.loadAndPopulateAccount(changeOwnership.videoChannelId, t)

    await changeOwnership.destroy({ transaction: t })

    await VideoChannelActivityModel.addChannelOwnershipChangeActivity({
      action: VideoChannelActivityAction.DELETE_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel,
      targetAccount: changeOwnership.NextOwner,
      transaction: t
    })

    logger.info('Channel ownership change request %d deleted.', changeOwnership.id)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
