import { ChangeOwnershipState, ChangeOwnershipStateType, HttpStatusCode, VideoChannelActivityAction } from '@peertube/peertube-models'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { MVideoFull } from '@server/types/models/index.js'
import express from 'express'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { sendUpdateVideo } from '../../../lib/activitypub/send/index.js'
import { changeVideoChannelShare } from '../../../lib/activitypub/share.js'
import { Notifier } from '../../../lib/notifier/notifier.js'
import {
  acceptOrRejectChangeOwnershipValidatorFactory,
  acceptVideoChangeOwnershipValidator,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  changeOwnershipSortValidator,
  changeVideoOwnershipValidator,
  deleteChangeVideoOwnershipValidator,
  listVideoOwnershipChangesValidator,
  paginationValidator,
  setDefaultPagination
} from '../../../middlewares/index.js'
import { ChangeOwnershipModel } from '../../../models/video/change-ownership.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { VideoModel } from '../../../models/video/video.js'

const ownershipVideoRouter = express.Router()

ownershipVideoRouter.post(
  '/:videoId/give-ownership',
  authenticate,
  asyncMiddleware(changeVideoOwnershipValidator),
  asyncRetryTransactionMiddleware(createChangeOwnershipRequest)
)

ownershipVideoRouter.get(
  '/:videoId/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  changeOwnershipSortValidator,
  asyncMiddleware(listVideoOwnershipChangesValidator),
  asyncRetryTransactionMiddleware(listVideoOwnershipChanges)
)

ownershipVideoRouter.get(
  '/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  asyncRetryTransactionMiddleware(listAccountVideoOwnershipChanges)
)

ownershipVideoRouter.post(
  '/ownership/:id/accept',
  authenticate,
  asyncMiddleware(acceptOrRejectChangeOwnershipValidatorFactory('video')),
  asyncMiddleware(acceptVideoChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(acceptOwnershipChange)
)

ownershipVideoRouter.post(
  '/ownership/:id/refuse',
  authenticate,
  asyncMiddleware(acceptOrRejectChangeOwnershipValidatorFactory('video')),
  asyncRetryTransactionMiddleware(refuseOwnershipChange)
)

ownershipVideoRouter.delete(
  '/ownership/:id',
  authenticate,
  asyncMiddleware(deleteChangeVideoOwnershipValidator),
  asyncRetryTransactionMiddleware(deleteOwnershipChange)
)

// ---------------------------------------------------------------------------

export {
  ownershipVideoRouter
}

// ---------------------------------------------------------------------------

async function createChangeOwnershipRequest (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithRights
  const initiatorAccountId = res.locals.oauth.token.User.Account.id
  const nextOwner = res.locals.changeOwnershipNextOwner

  const ownershipChange = await sequelizeTypescript.transaction(async t => {
    const ownershipChange = await ChangeOwnershipModel.create({
      initiatorAccountId,
      nextOwnerAccountId: nextOwner.id,
      videoId: video.id,
      state: ChangeOwnershipState.PENDING
    }, { transaction: t })

    await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
      action: VideoChannelActivityAction.SEND_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel: video.VideoChannel,
      video,
      targetAccount: nextOwner,
      transaction: t
    })

    return ownershipChange
  })

  const ownershipChangeFull = await ChangeOwnershipModel.load(ownershipChange.id)

  Notifier.Instance.notifyOfRequestedVideoOwnershipChange(ownershipChangeFull)

  logger.info('Ownership change for video %s created.', video.name)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listVideoOwnershipChanges (req: express.Request, res: express.Response) {
  const videoId = res.locals.videoWithRights.id
  const state = req.query.state as ChangeOwnershipStateType

  const resultList = await ChangeOwnershipModel.listForVideoApi({
    videoId,
    state,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort || 'createdAt'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountVideoOwnershipChanges (req: express.Request, res: express.Response) {
  const currentAccountId = res.locals.oauth.token.User.Account.id

  const resultList = await ChangeOwnershipModel.listForVideoApi({
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
    const channel = res.locals.videoChannel

    // We need more attributes for federation
    const targetVideo = await VideoModel.loadFull(changeOwnership.Video.id, t)

    const oldVideoChannel = await VideoChannelModel.loadAndPopulateAccount(targetVideo.channelId, t)

    targetVideo.channelId = channel.id

    const targetVideoUpdated = await targetVideo.save({ transaction: t }) as MVideoFull
    targetVideoUpdated.VideoChannel = channel

    if (canVideoBeFederated(targetVideoUpdated)) {
      await changeVideoChannelShare(targetVideoUpdated, oldVideoChannel, t)
      await sendUpdateVideo(targetVideoUpdated, t, oldVideoChannel.Account.Actor)
    }

    changeOwnership.state = ChangeOwnershipState.ACCEPTED
    await changeOwnership.save({ transaction: t })

    for (const channel of [ oldVideoChannel, targetVideoUpdated.VideoChannel ]) {
      await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
        action: VideoChannelActivityAction.ACCEPT_OWNERSHIP_REQUEST,
        user: res.locals.oauth.token.User,
        channel,
        video: targetVideoUpdated,
        targetAccount: changeOwnership.NextOwner,
        transaction: t
      })
    }

    Notifier.Instance.notifyOfAcceptedVideoOwnershipChange(changeOwnership)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function refuseOwnershipChange (req: express.Request, res: express.Response) {
  await sequelizeTypescript.transaction(async t => {
    const changeOwnership = res.locals.changeOwnership

    changeOwnership.state = ChangeOwnershipState.REJECTED
    await changeOwnership.save({ transaction: t })

    const channel = await VideoChannelModel.loadAndPopulateAccount(changeOwnership.Video.channelId, t)

    await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
      action: VideoChannelActivityAction.REFUSE_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel,
      video: changeOwnership.Video,
      targetAccount: changeOwnership.NextOwner,
      transaction: t
    })

    Notifier.Instance.notifyOfRejectedVideoOwnershipChange(changeOwnership)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteOwnershipChange (req: express.Request, res: express.Response) {
  await sequelizeTypescript.transaction(async t => {
    const changeOwnership = res.locals.changeOwnership
    const channel = await VideoChannelModel.loadAndPopulateAccount(changeOwnership.Video.channelId, t)

    await changeOwnership.destroy({ transaction: t })

    await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
      action: VideoChannelActivityAction.DELETE_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel,
      video: changeOwnership.Video,
      targetAccount: changeOwnership.NextOwner,
      transaction: t
    })

    logger.info('Video ownership change request %d deleted.', changeOwnership.id)
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
