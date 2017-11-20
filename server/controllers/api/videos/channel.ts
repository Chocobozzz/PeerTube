import * as express from 'express'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../../shared'
import { getFormattedObjects, logger, resetSequelizeInstance, retryTransactionWrapper } from '../../../helpers'
import { database as db } from '../../../initializers'
import { createVideoChannel } from '../../../lib'
import {
  asyncMiddleware,
  authenticate,
  listVideoAccountChannelsValidator,
  paginationValidator,
  setPagination,
  setVideoChannelsSort,
  videoChannelsGetValidator,
  videoChannelsAddValidator,
  videoChannelsRemoveValidator,
  videoChannelsSortValidator,
  videoChannelsUpdateValidator
} from '../../../middlewares'
import { AccountInstance, VideoChannelInstance } from '../../../models'
import { sendUpdateVideoChannel } from '../../../lib/activitypub/send/send-update'

const videoChannelRouter = express.Router()

videoChannelRouter.get('/channels',
  paginationValidator,
  videoChannelsSortValidator,
  setVideoChannelsSort,
  setPagination,
  asyncMiddleware(listVideoChannels)
)

videoChannelRouter.get('/accounts/:accountId/channels',
  listVideoAccountChannelsValidator,
  asyncMiddleware(listVideoAccountChannels)
)

videoChannelRouter.post('/channels',
  authenticate,
  videoChannelsAddValidator,
  asyncMiddleware(addVideoChannelRetryWrapper)
)

videoChannelRouter.put('/channels/:id',
  authenticate,
  videoChannelsUpdateValidator,
  updateVideoChannelRetryWrapper
)

videoChannelRouter.delete('/channels/:id',
  authenticate,
  videoChannelsRemoveValidator,
  asyncMiddleware(removeVideoChannelRetryWrapper)
)

videoChannelRouter.get('/channels/:id',
  videoChannelsGetValidator,
  asyncMiddleware(getVideoChannel)
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

async function listVideoChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.VideoChannel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoAccountChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.VideoChannel.listByAccount(res.locals.account.id)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

// Wrapper to video channel add that retry the async function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
async function addVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video video channel with many retries.'
  }

  await retryTransactionWrapper(addVideoChannel, options)

  // TODO : include Location of the new video channel -> 201
  return res.type('json').status(204).end()
}

async function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body
  const account: AccountInstance = res.locals.oauth.token.User.Account
  let videoChannelCreated: VideoChannelInstance

  await db.sequelize.transaction(async t => {
    videoChannelCreated = await createVideoChannel(videoChannelInfo, account, t)
  })

  logger.info('Video channel with uuid %s created.', videoChannelCreated.uuid)
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
  const videoChannelInstance: VideoChannelInstance = res.locals.videoChannel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const videoChannelInfoToUpdate: VideoChannelUpdate = req.body

  try {
    await db.sequelize.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoChannelInfoToUpdate.name !== undefined) videoChannelInstance.set('name', videoChannelInfoToUpdate.name)
      if (videoChannelInfoToUpdate.description !== undefined) videoChannelInstance.set('description', videoChannelInfoToUpdate.description)

      const videoChannelInstanceUpdated = await videoChannelInstance.save(sequelizeOptions)

      await sendUpdateVideoChannel(videoChannelInstanceUpdated, t)
    })

    logger.info('Video channel with name %s and uuid %s updated.', videoChannelInstance.name, videoChannelInstance.uuid)
  } catch (err) {
    logger.debug('Cannot update the video channel.', err)

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
  const videoChannelInstance: VideoChannelInstance = res.locals.videoChannel

  await db.sequelize.transaction(async t => {
    await videoChannelInstance.destroy({ transaction: t })
  })

  logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.uuid)
}

async function getVideoChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannelWithVideos = await db.VideoChannel.loadAndPopulateAccountAndVideos(res.locals.videoChannel.id)

  return res.json(videoChannelWithVideos.toFormattedJSON())
}
