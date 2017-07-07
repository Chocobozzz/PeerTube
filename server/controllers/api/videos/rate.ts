import * as express from 'express'

import { database as db } from '../../../initializers/database'
import {
  logger,
  retryTransactionWrapper
} from '../../../helpers'
import {
  VIDEO_RATE_TYPES,
  REQUEST_VIDEO_EVENT_TYPES,
  REQUEST_VIDEO_QADU_TYPES
} from '../../../initializers'
import {
  addEventsToRemoteVideo,
  quickAndDirtyUpdatesVideoToFriends
} from '../../../lib'
import {
  authenticate,
  videoRateValidator
} from '../../../middlewares'

const rateVideoRouter = express.Router()

rateVideoRouter.put('/:id/rate',
  authenticate,
  videoRateValidator,
  rateVideoRetryWrapper
)

// ---------------------------------------------------------------------------

export {
  rateVideoRouter
}

// ---------------------------------------------------------------------------

function rateVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the user video rate.'
  }

  retryTransactionWrapper(rateVideo, options)
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function rateVideo (req: express.Request, res: express.Response) {
  const rateType = req.body.rating
  const videoInstance = res.locals.video
  const userInstance = res.locals.oauth.token.User

  return db.sequelize.transaction(t => {
    return db.UserVideoRate.load(userInstance.id, videoInstance.id, t)
      .then(previousRate => {
        const options = { transaction: t }

        let likesToIncrement = 0
        let dislikesToIncrement = 0

        if (rateType === VIDEO_RATE_TYPES.LIKE) likesToIncrement++
        else if (rateType === VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement++

        // There was a previous rate, update it
        if (previousRate) {
          // We will remove the previous rate, so we will need to remove it from the video attribute
          if (previousRate.type === VIDEO_RATE_TYPES.LIKE) likesToIncrement--
          else if (previousRate.type === VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement--

          previousRate.type = rateType

          return previousRate.save(options).then(() => ({ t, likesToIncrement, dislikesToIncrement }))
        } else { // There was not a previous rate, insert a new one
          const query = {
            userId: userInstance.id,
            videoId: videoInstance.id,
            type: rateType
          }

          return db.UserVideoRate.create(query, options).then(() => ({ likesToIncrement, dislikesToIncrement }))
        }
      })
      .then(({ likesToIncrement, dislikesToIncrement }) => {
        const options = { transaction: t }
        const incrementQuery = {
          likes: likesToIncrement,
          dislikes: dislikesToIncrement
        }

        // Even if we do not own the video we increment the attributes
        // It is usefull for the user to have a feedback
        return videoInstance.increment(incrementQuery, options).then(() => ({ likesToIncrement, dislikesToIncrement }))
      })
      .then(({ likesToIncrement, dislikesToIncrement }) => {
        // No need for an event type, we own the video
        if (videoInstance.isOwned()) return { likesToIncrement, dislikesToIncrement }

        const eventsParams = []

        if (likesToIncrement !== 0) {
          eventsParams.push({
            videoId: videoInstance.id,
            type: REQUEST_VIDEO_EVENT_TYPES.LIKES,
            count: likesToIncrement
          })
        }

        if (dislikesToIncrement !== 0) {
          eventsParams.push({
            videoId: videoInstance.id,
            type: REQUEST_VIDEO_EVENT_TYPES.DISLIKES,
            count: dislikesToIncrement
          })
        }

        return addEventsToRemoteVideo(eventsParams, t).then(() => ({ likesToIncrement, dislikesToIncrement }))
      })
      .then(({ likesToIncrement, dislikesToIncrement }) => {
        // We do not own the video, there is no need to send a quick and dirty update to friends
        // Our rate was already sent by the addEvent function
        if (videoInstance.isOwned() === false) return undefined

        const qadusParams = []

        if (likesToIncrement !== 0) {
          qadusParams.push({
            videoId: videoInstance.id,
            type: REQUEST_VIDEO_QADU_TYPES.LIKES
          })
        }

        if (dislikesToIncrement !== 0) {
          qadusParams.push({
            videoId: videoInstance.id,
            type: REQUEST_VIDEO_QADU_TYPES.DISLIKES
          })
        }

        return quickAndDirtyUpdatesVideoToFriends(qadusParams, t)
      })
  })
  .then(() => logger.info('User video rate for video %s of user %s updated.', videoInstance.name, userInstance.username))
  .catch(err => {
    // This is just a debug because we will retry the insert
    logger.debug('Cannot add the user video rate.', err)
    throw err
  })
}
