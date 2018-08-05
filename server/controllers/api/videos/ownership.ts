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
import { VideoChangeOwnershipCreate, VideoChangeOwnershipStatus } from '../../../../shared/models/videos'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getFormattedObjects } from '../../../helpers/utils'

const ownershipVideoRouter = express.Router()

ownershipVideoRouter.post('/:id/give-ownership',
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
  const initiatorAccount = res.locals.oauth.token.User.Account as AccountModel
  const body: VideoChangeOwnershipCreate = req.body

  await sequelizeTypescript.transaction(async t => {
    const nextOwner = await AccountModel.loadLocalByName(body.username)
    if (nextOwner) {
      const videoChangeOwnershipToCreate = {
        initiatorAccountId: initiatorAccount.id,
        nextOwnerAccountId: nextOwner.id,
        videoId: videoInstance.id,
        status: VideoChangeOwnershipStatus.WAITING
      }
      await VideoChangeOwnershipModel.create(videoChangeOwnershipToCreate, { transaction: t })

      logger.info('Ownership change for video %s created.', videoInstance.name)
      return res.type('json').status(204).end()
    } else {
      return res.type('json').status(400).end()
    }
  })
}

async function listVideoOwnership (req: express.Request, res: express.Response) {
  const currentAccount = res.locals.oauth.token.User.Account as AccountModel
  const resultList = await VideoChangeOwnershipModel.listForApi(
    currentAccount.id,
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

    targetVideo.set('channelId', channel.id)

    await targetVideo.save()
    videoChangeOwnership.set('status', VideoChangeOwnershipStatus.ACCEPTED)
    await videoChangeOwnership.save()

    return res.sendStatus(204)
  })
}

async function refuseOwnership (req: express.Request, res: express.Response) {
  return sequelizeTypescript.transaction(async t => {
    const videoChangeOwnership = res.locals.videoChangeOwnership as VideoChangeOwnershipModel
    videoChangeOwnership.set('status', VideoChangeOwnershipStatus.REFUSED)
    await videoChangeOwnership.save()
    return res.sendStatus(204)
  })
}
