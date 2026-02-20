import { HttpStatusCode, VideoChangeOwnershipStatus, VideoChannelActivityAction } from '@peertube/peertube-models'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import express from 'express'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { sendUpdateVideo } from '../../../lib/activitypub/send/index.js'
import { changeVideoChannelShare } from '../../../lib/activitypub/share.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  videosAcceptChangeOwnershipValidator,
  videosChangeOwnershipValidator,
  videosTerminateChangeOwnershipValidator
} from '../../../middlewares/index.js'
import { VideoChangeOwnershipModel } from '../../../models/video/video-change-ownership.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { VideoModel } from '../../../models/video/video.js'

const ownershipVideoRouter = express.Router()

ownershipVideoRouter.post(
  '/:videoId/give-ownership',
  authenticate,
  asyncMiddleware(videosChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(giveVideoOwnership)
)

ownershipVideoRouter.get(
  '/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  asyncRetryTransactionMiddleware(listVideoOwnership)
)

ownershipVideoRouter.post(
  '/ownership/:id/accept',
  authenticate,
  asyncMiddleware(videosTerminateChangeOwnershipValidator),
  asyncMiddleware(videosAcceptChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(acceptOwnership)
)

ownershipVideoRouter.post(
  '/ownership/:id/refuse',
  authenticate,
  asyncMiddleware(videosTerminateChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(refuseOwnership)
)

// ---------------------------------------------------------------------------

export {
  ownershipVideoRouter
}

// ---------------------------------------------------------------------------

async function giveVideoOwnership (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const initiatorAccountId = res.locals.oauth.token.User.Account.id
  const nextOwner = res.locals.videoChangeOwnershipNextOwner

  await sequelizeTypescript.transaction(async t => {
    await VideoChangeOwnershipModel.findOrCreate({
      where: {
        initiatorAccountId,
        nextOwnerAccountId: nextOwner.id,
        videoId: video.id,
        status: VideoChangeOwnershipStatus.WAITING
      },
      defaults: {
        initiatorAccountId,
        nextOwnerAccountId: nextOwner.id,
        videoId: video.id,
        status: VideoChangeOwnershipStatus.WAITING
      },
      transaction: t
    })

    await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
      action: VideoChannelActivityAction.SEND_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel: video.VideoChannel,
      video,
      targetAccount: nextOwner,
      transaction: t
    })
  })

  logger.info('Ownership change for video %s created.', video.name)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listVideoOwnership (req: express.Request, res: express.Response) {
  const currentAccountId = res.locals.oauth.token.User.Account.id

  const resultList = await VideoChangeOwnershipModel.listForApi(
    currentAccountId,
    req.query.start,
    req.query.count,
    req.query.sort || 'createdAt'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

function acceptOwnership (req: express.Request, res: express.Response) {
  return sequelizeTypescript.transaction(async t => {
    const videoChangeOwnership = res.locals.videoChangeOwnership
    const channel = res.locals.videoChannel

    // We need more attributes for federation
    const targetVideo = await VideoModel.loadFull(videoChangeOwnership.Video.id, t)

    const oldVideoChannel = await VideoChannelModel.loadAndPopulateAccount(targetVideo.channelId, t)

    targetVideo.channelId = channel.id

    const targetVideoUpdated = await targetVideo.save({ transaction: t }) as MVideoFullLight
    targetVideoUpdated.VideoChannel = channel

    if (canVideoBeFederated(targetVideoUpdated)) {
      await changeVideoChannelShare(targetVideoUpdated, oldVideoChannel, t)
      await sendUpdateVideo(targetVideoUpdated, t, oldVideoChannel.Account.Actor)
    }

    videoChangeOwnership.status = VideoChangeOwnershipStatus.ACCEPTED
    await videoChangeOwnership.save({ transaction: t })

    for (const channel of [ oldVideoChannel, targetVideoUpdated.VideoChannel ]) {
      await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
        action: VideoChannelActivityAction.ACCEPT_OWNERSHIP_REQUEST,
        user: res.locals.oauth.token.User,
        channel,
        video: targetVideoUpdated,
        targetAccount: videoChangeOwnership.NextOwner,
        transaction: t
      })
    }

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}

function refuseOwnership (req: express.Request, res: express.Response) {
  return sequelizeTypescript.transaction(async t => {
    const videoChangeOwnership = res.locals.videoChangeOwnership

    videoChangeOwnership.status = VideoChangeOwnershipStatus.REFUSED
    await videoChangeOwnership.save({ transaction: t })

    const channel = await VideoChannelModel.loadAndPopulateAccount(videoChangeOwnership.Video.channelId, t)

    await VideoChannelActivityModel.addVideoOwnershipChangeActivity({
      action: VideoChannelActivityAction.REFUSE_OWNERSHIP_REQUEST,
      user: res.locals.oauth.token.User,
      channel,
      video: videoChangeOwnership.Video,
      targetAccount: videoChangeOwnership.NextOwner,
      transaction: t
    })

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}
