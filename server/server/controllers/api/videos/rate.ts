import express from 'express'
import { HttpStatusCode, UserVideoRateUpdate } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { VIDEO_RATE_TYPES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { getLocalRateUrl, sendVideoRateChange } from '../../../lib/activitypub/video-rates.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoUpdateRateValidator } from '../../../middlewares/index.js'
import { AccountModel } from '../../../models/account/account.js'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate.js'

const rateVideoRouter = express.Router()

rateVideoRouter.put('/:id/rate',
  authenticate,
  asyncMiddleware(videoUpdateRateValidator),
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
  const videoInstance = res.locals.videoAll
  const userAccount = res.locals.oauth.token.User.Account

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const accountInstance = await AccountModel.load(userAccount.id, t)
    const previousRate = await AccountVideoRateModel.load(accountInstance.id, videoInstance.id, t)

    // Same rate, nothing do to
    if (rateType === 'none' && !previousRate || previousRate?.type === rateType) return

    let likesToIncrement = 0
    let dislikesToIncrement = 0

    if (rateType === VIDEO_RATE_TYPES.LIKE) likesToIncrement++
    else if (rateType === VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement++

    // There was a previous rate, update it
    if (previousRate) {
      // We will remove the previous rate, so we will need to update the video count attribute
      if (previousRate.type === 'like') likesToIncrement--
      else if (previousRate.type === 'dislike') dislikesToIncrement--

      if (rateType === 'none') { // Destroy previous rate
        await previousRate.destroy(sequelizeOptions)
      } else { // Update previous rate
        previousRate.type = rateType
        previousRate.url = getLocalRateUrl(rateType, userAccount.Actor, videoInstance)
        await previousRate.save(sequelizeOptions)
      }
    } else if (rateType !== 'none') { // There was not a previous rate, insert a new one if there is a rate
      const query = {
        accountId: accountInstance.id,
        videoId: videoInstance.id,
        type: rateType,
        url: getLocalRateUrl(rateType, userAccount.Actor, videoInstance)
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

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}
