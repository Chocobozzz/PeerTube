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
  videoRateValidator,
  asyncMiddleware
} from '../../../middlewares'
import { UserVideoRateUpdate } from '../../../../shared'

const rateVideoRouter = express.Router()

rateVideoRouter.put('/:id/rate',
  authenticate,
  videoRateValidator,
  asyncMiddleware(rateVideoRetryWrapper)
)

// ---------------------------------------------------------------------------

export {
  rateVideoRouter
}

// ---------------------------------------------------------------------------

async function rateVideoRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the user video rate.'
  }

  await retryTransactionWrapper(rateVideo, options)

  return res.type('json').status(204).end()
}

async function rateVideo (req: express.Request, res: express.Response) {
  const body: UserVideoRateUpdate = req.body
  const rateType = body.rating
  const videoInstance = res.locals.video
  const userInstance = res.locals.oauth.token.User

  await db.sequelize.transaction(async t => {
    const sequelizeOptions = { transaction: t }
    const previousRate = await db.UserVideoRate.load(userInstance.id, videoInstance.id, t)

    let likesToIncrement = 0
    let dislikesToIncrement = 0

    if (rateType === VIDEO_RATE_TYPES.LIKE) likesToIncrement++
    else if (rateType === VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement++

    // There was a previous rate, update it
    if (previousRate) {
      // We will remove the previous rate, so we will need to update the video count attribute
      if (previousRate.type === VIDEO_RATE_TYPES.LIKE) likesToIncrement--
      else if (previousRate.type === VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement--

      if (rateType === 'none') { // Destroy previous rate
        await previousRate.destroy()
      } else { // Update previous rate
        previousRate.type = rateType

        await previousRate.save()
      }
    } else if (rateType !== 'none') { // There was not a previous rate, insert a new one if there is a rate
      const query = {
        userId: userInstance.id,
        videoId: videoInstance.id,
        type: rateType
      }

      await db.UserVideoRate.create(query, sequelizeOptions)
    }

    const incrementQuery = {
      likes: likesToIncrement,
      dislikes: dislikesToIncrement
    }

    // Even if we do not own the video we increment the attributes
    // It is useful for the user to have a feedback
    await videoInstance.increment(incrementQuery, sequelizeOptions)

    // Send a event to original pod
    if (videoInstance.isOwned() === false) {

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

      await addEventsToRemoteVideo(eventsParams, t)
    } else { // We own the video, we need to send a quick and dirty update to friends to notify the counts changed
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

      await quickAndDirtyUpdatesVideoToFriends(qadusParams, t)
    }
  })

  logger.info('User video rate for video %s of user %s updated.', videoInstance.name, userInstance.username)
}
