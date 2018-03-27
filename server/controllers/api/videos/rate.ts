import * as express from 'express'
import { UserVideoRateUpdate } from '../../../../shared'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript, VIDEO_RATE_TYPES } from '../../../initializers'
import { sendVideoRateChange } from '../../../lib/activitypub'
import { asyncMiddleware, authenticate, videoRateValidator } from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoModel } from '../../../models/video/video'

const rateVideoRouter = express.Router()

rateVideoRouter.put('/:id/rate',
  authenticate,
  asyncMiddleware(videoRateValidator),
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
  const videoInstance: VideoModel = res.locals.video
  const accountInstance: AccountModel = res.locals.oauth.token.User.Account

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }
    const previousRate = await AccountVideoRateModel.load(accountInstance.id, videoInstance.id, t)

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
        await previousRate.destroy({ transaction: t })
      } else { // Update previous rate
        previousRate.type = rateType
        await previousRate.save({ transaction: t })
      }
    } else if (rateType !== 'none') { // There was not a previous rate, insert a new one if there is a rate
      const query = {
        accountId: accountInstance.id,
        videoId: videoInstance.id,
        type: rateType
      }

      await AccountVideoRateModel.create(query, sequelizeOptions)
    }

    const incrementQuery = {
      likes: likesToIncrement,
      dislikes: dislikesToIncrement
    }

    // Even if we do not own the video we increment the attributes
    // It is useful for the user to have a feedback
    await videoInstance.increment(incrementQuery, sequelizeOptions)

    await sendVideoRateChange(accountInstance, videoInstance, likesToIncrement, dislikesToIncrement, t)
  })

  logger.info('Account video rate for video %s of account %s updated.', videoInstance.name, accountInstance.name)
}
