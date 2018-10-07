import * as express from 'express'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  videosAcceptChangeOwnershipValidator,
  videosChangeOwnershipValidator,
  videosTerminateChangeOwnershipValidator
} from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChangeOwnershipModel } from '../../../models/video/video-change-ownership'
import { VideoChangeOwnershipStatus, VideoPrivacy, VideoState } from '../../../../shared/models/videos'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getFormattedObjects } from '../../../helpers/utils'
import { changeVideoChannelShare } from '../../../lib/activitypub'
import { sendUpdateVideo } from '../../../lib/activitypub/send'
import { UserModel } from '../../../models/account/user'

const ownershipVideoRouter = express.Router()

ownershipVideoRouter.post('/:videoId/give-ownership',
  authenticate,
  asyncMiddleware(videosChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(giveVideoOwnership)
)

ownershipVideoRouter.get('/ownership',
  authenticate,
  paginationValidator,
  setDefaultPagination,
  asyncRetryTransactionMiddleware(listVideoOwnership)
)

ownershipVideoRouter.post('/ownership/:id/accept',
  authenticate,
  asyncMiddleware(videosTerminateChangeOwnershipValidator),
  asyncMiddleware(videosAcceptChangeOwnershipValidator),
  asyncRetryTransactionMiddleware(acceptOwnership)
)

ownershipVideoRouter.post('/ownership/:id/refuse',
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
  const videoInstance = res.locals.video as VideoModel
  const initiatorAccountId = (res.locals.oauth.token.User as UserModel).Account.id
  const nextOwner = res.locals.nextOwner as AccountModel

  await sequelizeTypescript.transaction(t => {
    return VideoChangeOwnershipModel.findOrCreate({
      where: {
        initiatorAccountId,
        nextOwnerAccountId: nextOwner.id,
        videoId: videoInstance.id,
        status: VideoChangeOwnershipStatus.WAITING
      },
      defaults: {
        initiatorAccountId,
        nextOwnerAccountId: nextOwner.id,
        videoId: videoInstance.id,
        status: VideoChangeOwnershipStatus.WAITING
      },
      transaction: t
    })
  })

  logger.info('Ownership change for video %s created.', videoInstance.name)
  return res.type('json').status(204).end()
}

async function listVideoOwnership (req: express.Request, res: express.Response) {
  const currentAccountId = (res.locals.oauth.token.User as UserModel).Account.id

  const resultList = await VideoChangeOwnershipModel.listForApi(
    currentAccountId,
    req.query.start || 0,
    req.query.count || 10,
    req.query.sort || 'createdAt'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function acceptOwnership (req: express.Request, res: express.Response) {
  return sequelizeTypescript.transaction(async t => {
    const videoChangeOwnership = res.locals.videoChangeOwnership as VideoChangeOwnershipModel
    const targetVideo = videoChangeOwnership.Video
    const channel = res.locals.videoChannel as VideoChannelModel

    const oldVideoChannel = await VideoChannelModel.loadByIdAndPopulateAccount(targetVideo.channelId)

    targetVideo.set('channelId', channel.id)
    const targetVideoUpdated = await targetVideo.save({ transaction: t })
    targetVideoUpdated.VideoChannel = channel

    if (targetVideoUpdated.privacy !== VideoPrivacy.PRIVATE && targetVideoUpdated.state === VideoState.PUBLISHED) {
      await changeVideoChannelShare(targetVideoUpdated, oldVideoChannel, t)
      await sendUpdateVideo(targetVideoUpdated, t, oldVideoChannel.Account.Actor)
    }

    videoChangeOwnership.set('status', VideoChangeOwnershipStatus.ACCEPTED)
    await videoChangeOwnership.save({ transaction: t })

    return res.sendStatus(204)
  })
}

async function refuseOwnership (req: express.Request, res: express.Response) {
  return sequelizeTypescript.transaction(async t => {
    const videoChangeOwnership = res.locals.videoChangeOwnership as VideoChangeOwnershipModel

    videoChangeOwnership.set('status', VideoChangeOwnershipStatus.REFUSED)
    await videoChangeOwnership.save({ transaction: t })

    return res.sendStatus(204)
  })
}
