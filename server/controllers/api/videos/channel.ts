import * as express from 'express'

import { database as db } from '../../../initializers'
import {
  logger,
  getFormattedObjects,
  retryTransactionWrapper
} from '../../../helpers'
import {
  authenticate,
  paginationValidator,
  videoChannelsSortValidator,
  videoChannelsAddValidator,
  setVideoChannelsSort,
  setPagination,
  videoChannelsRemoveValidator,
  videoChannelGetValidator,
  videoChannelsUpdateValidator,
  listVideoAuthorChannelsValidator
} from '../../../middlewares'
import {
  createVideoChannel,
  updateVideoChannelToFriends
} from '../../../lib'
import { VideoChannelInstance, AuthorInstance } from '../../../models'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../../shared'

const videoChannelRouter = express.Router()

videoChannelRouter.get('/channels',
  paginationValidator,
  videoChannelsSortValidator,
  setVideoChannelsSort,
  setPagination,
  listVideoChannels
)

videoChannelRouter.get('/authors/:authorId/channels',
  listVideoAuthorChannelsValidator,
  listVideoAuthorChannels
)

videoChannelRouter.post('/channels',
  authenticate,
  videoChannelsAddValidator,
  addVideoChannelRetryWrapper
)

videoChannelRouter.put('/channels/:id',
  authenticate,
  videoChannelsUpdateValidator,
  updateVideoChannelRetryWrapper
)

videoChannelRouter.delete('/channels/:id',
  authenticate,
  videoChannelsRemoveValidator,
  removeVideoChannelRetryWrapper
)

videoChannelRouter.get('/channels/:id',
  videoChannelGetValidator,
  getVideoChannel
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

function listVideoChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.VideoChannel.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(result => res.json(getFormattedObjects(result.data, result.total)))
    .catch(err => next(err))
}

function listVideoAuthorChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.VideoChannel.listByAuthor(res.locals.author.id)
    .then(result => res.json(getFormattedObjects(result.data, result.total)))
    .catch(err => next(err))
}

// Wrapper to video channel add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
function addVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video video channel with many retries.'
  }

  retryTransactionWrapper(addVideoChannel, options)
    .then(() => {
      // TODO : include Location of the new video channel -> 201
      res.type('json').status(204).end()
    })
    .catch(err => next(err))
}

function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body
  const author: AuthorInstance = res.locals.oauth.token.User.Author

  return db.sequelize.transaction(t => {
    return createVideoChannel(videoChannelInfo, author, t)
  })
  .then(videoChannelUUID => logger.info('Video channel with uuid %s created.', videoChannelUUID))
  .catch((err: Error) => {
    logger.debug('Cannot insert the video channel.', err)
    throw err
  })
}

function updateVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  retryTransactionWrapper(updateVideoChannel, options)
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function updateVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance: VideoChannelInstance = res.locals.videoChannel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const videoChannelInfoToUpdate: VideoChannelUpdate = req.body

  return db.sequelize.transaction(t => {
    const options = {
      transaction: t
    }

    if (videoChannelInfoToUpdate.name !== undefined) videoChannelInstance.set('name', videoChannelInfoToUpdate.name)
    if (videoChannelInfoToUpdate.description !== undefined) videoChannelInstance.set('description', videoChannelInfoToUpdate.description)

    return videoChannelInstance.save(options)
      .then(() => {
        const json = videoChannelInstance.toUpdateRemoteJSON()

        // Now we'll update the video channel's meta data to our friends
        return updateVideoChannelToFriends(json, t)
      })
  })
    .then(() => {
      logger.info('Video channel with name %s and uuid %s updated.', videoChannelInstance.name, videoChannelInstance.uuid)
    })
    .catch(err => {
      logger.debug('Cannot update the video channel.', err)

      // Force fields we want to update
      // If the transaction is retried, sequelize will think the object has not changed
      // So it will skip the SQL request, even if the last one was ROLLBACKed!
      Object.keys(videoChannelFieldsSave).forEach(key => {
        const value = videoChannelFieldsSave[key]
        videoChannelInstance.set(key, value)
      })

      throw err
    })
}

function removeVideoChannelRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot remove the video channel with many retries.'
  }

  retryTransactionWrapper(removeVideoChannel, options)
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function removeVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance: VideoChannelInstance = res.locals.videoChannel

  return db.sequelize.transaction(t => {
    return videoChannelInstance.destroy({ transaction: t })
  })
  .then(() => {
    logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.uuid)
  })
  .catch(err => {
    logger.error('Errors when removed the video channel.', err)
    throw err
  })
}

function getVideoChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.VideoChannel.loadAndPopulateAuthorAndVideos(res.locals.videoChannel.id)
    .then(videoChannelWithVideos => res.json(videoChannelWithVideos.toFormattedJSON()))
    .catch(err => next(err))
}
