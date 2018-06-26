import * as express from 'express'
import { getFormattedObjects, resetSequelizeInstance } from '../../helpers/utils'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoChannelsAddValidator,
  videoChannelsGetValidator,
  videoChannelsRemoveValidator,
  videoChannelsSortValidator,
  videoChannelsUpdateValidator
} from '../../middlewares'
import { VideoChannelModel } from '../../models/video/video-channel'
import { videosSortValidator } from '../../middlewares/validators'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../shared'
import { createVideoChannel } from '../../lib/video-channel'
import { isNSFWHidden } from '../../helpers/express-utils'
import { setAsyncActorKeys } from '../../lib/activitypub'
import { AccountModel } from '../../models/account/account'
import { sequelizeTypescript } from '../../initializers'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'

const videoChannelRouter = express.Router()

videoChannelRouter.get('/',
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoChannels)
)

videoChannelRouter.post('/',
  authenticate,
  videoChannelsAddValidator,
  asyncRetryTransactionMiddleware(addVideoChannel)
)

videoChannelRouter.put('/:id',
  authenticate,
  asyncMiddleware(videoChannelsUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideoChannel)
)

videoChannelRouter.delete('/:id',
  authenticate,
  asyncMiddleware(videoChannelsRemoveValidator),
  asyncRetryTransactionMiddleware(removeVideoChannel)
)

videoChannelRouter.get('/:id',
  asyncMiddleware(videoChannelsGetValidator),
  asyncMiddleware(getVideoChannel)
)

videoChannelRouter.get('/:id/videos',
  asyncMiddleware(videoChannelsGetValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  optionalAuthenticate,
  asyncMiddleware(listVideoChannelVideos)
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

async function listVideoChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoChannelModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body
  const account: AccountModel = res.locals.oauth.token.User.Account

  const videoChannelCreated: VideoChannelModel = await sequelizeTypescript.transaction(async t => {
    return createVideoChannel(videoChannelInfo, account, t)
  })

  setAsyncActorKeys(videoChannelCreated.Actor)
    .catch(err => logger.error('Cannot set async actor keys for account %s.', videoChannelCreated.Actor.uuid, { err }))

  logger.info('Video channel with uuid %s created.', videoChannelCreated.Actor.uuid)

  return res.json({
    videoChannel: {
      id: videoChannelCreated.id,
      uuid: videoChannelCreated.Actor.uuid
    }
  }).end()
}

async function updateVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel as VideoChannelModel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const videoChannelInfoToUpdate = req.body as VideoChannelUpdate

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoChannelInfoToUpdate.displayName !== undefined) videoChannelInstance.set('name', videoChannelInfoToUpdate.displayName)
      if (videoChannelInfoToUpdate.description !== undefined) videoChannelInstance.set('description', videoChannelInfoToUpdate.description)
      if (videoChannelInfoToUpdate.support !== undefined) videoChannelInstance.set('support', videoChannelInfoToUpdate.support)

      const videoChannelInstanceUpdated = await videoChannelInstance.save(sequelizeOptions)
      await sendUpdateActor(videoChannelInstanceUpdated, t)
    })

    logger.info('Video channel with name %s and uuid %s updated.', videoChannelInstance.name, videoChannelInstance.Actor.uuid)
  } catch (err) {
    logger.debug('Cannot update the video channel.', { err })

    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoChannelInstance, videoChannelFieldsSave)

    throw err
  }

  return res.type('json').status(204).end()
}

async function removeVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance: VideoChannelModel = res.locals.videoChannel

  await sequelizeTypescript.transaction(async t => {
    await videoChannelInstance.destroy({ transaction: t })

    logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.Actor.uuid)
  })

  return res.type('json').status(204).end()
}

async function getVideoChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannelWithVideos = await VideoChannelModel.loadAndPopulateAccountAndVideos(res.locals.videoChannel.id)

  return res.json(videoChannelWithVideos.toFormattedJSON())
}

async function listVideoChannelVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannelInstance: VideoChannelModel = res.locals.videoChannel

  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    hideNSFW: isNSFWHidden(res),
    withFiles: false,
    videoChannelId: videoChannelInstance.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
