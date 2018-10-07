import * as express from 'express'
import { UserVideoRateUpdate } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript, VIDEO_RATE_TYPES } from '../../../initializers'
import { sendVideoRateChange } from '../../../lib/activitypub'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoRateValidator } from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoModel } from '../../../models/video/video'

const rateVideoRouter = express.Router()

rateVideoRouter.put('/:id/rate',
  authenticate,
  asyncMiddleware(videoRateValidator),
  asyncRetryTransactionMiddleware(rateVideo)
)

// ---------------------------------------------------------------------------

export {
  rateVideoRouter
}

// ---------------------------------------------------------------------------

async function rateVideo (req: express.Request, res: express.Response) {
  const body: UserVideoRateUpdate = req.body
  const rateType = body.rating
  const videoInstance: VideoModel = res.locals.video

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const accountInstance = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)
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
        await previousRate.destroy(sequelizeOptions)
      } else { // Update previous rate
        previousRate.type = rateType
        await previousRate.save(sequelizeOptions)
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

    await videoInstance.increment(incrementQuery, sequelizeOptions)

    await sendVideoRateChange(accountInstance, videoInstance, likesToIncrement, dislikesToIncrement, t)

    logger.info('Account video rate for video %s of account %s updated.', videoInstance.name, accountInstance.name)
  })

  return res.type('json').status(204).end()
}
