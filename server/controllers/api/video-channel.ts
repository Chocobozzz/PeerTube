import * as express from 'express'
import { getFormattedObjects, resetSequelizeInstance } from '../../helpers/utils'
import {
  asyncMiddleware,
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
import { retryTransactionWrapper } from '../../helpers/database-utils'
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
  asyncMiddleware(addVideoChannelRetryWrapper)
)

videoChannelRouter.put('/:id',
  authenticate,
  asyncMiddleware(videoChannelsUpdateValidator),
  updateVideoChannelRetryWrapper
)

videoChannelRouter.delete('/:id',
  authenticate,
  asyncMiddleware(videoChannelsRemoveValidator),
  asyncMiddleware(removeVideoChannelRetryWrapper)
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

// Wrapper to video channel add that retry the async function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
async function addVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video video channel with many retries.'
  }

  const videoChannel = await retryTransactionWrapper(addVideoChannel, options)
  return res.json({
    videoChannel: {
      id: videoChannel.id,
      uuid: videoChannel.Actor.uuid
    }
  }).end()
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

  return videoChannelCreated
}

async function updateVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  await retryTransactionWrapper(updateVideoChannel, options)

  return res.type('json').status(204).end()
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
}

async function removeVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot remove the video channel with many retries.'
  }

  await retryTransactionWrapper(removeVideoChannel, options)

  return res.type('json').status(204).end()
}

async function removeVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance: VideoChannelModel = res.locals.videoChannel

  return sequelizeTypescript.transaction(async t => {
    await videoChannelInstance.destroy({ transaction: t })

    logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.Actor.uuid)
  })

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
