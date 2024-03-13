import { VIDEO_RATE_TYPES } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountVideoRateModel } from '@server/models/account/account-video-rate.js'
import { AccountModel } from '@server/models/account/account.js'
import { getLocalRateUrl, sendVideoRateChange } from './activitypub/video-rates.js'
import { MAccountId, MAccountUrl, MVideoFullLight } from '@server/types/models/index.js'
import { UserVideoRateType } from '@peertube/peertube-models'

export async function userRateVideo (options: {
  rateType: UserVideoRateType
  account: MAccountUrl & MAccountId
  video: MVideoFullLight
}) {
  const { account, rateType, video } = options

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const accountInstance = await AccountModel.load(account.id, t)
    const previousRate = await AccountVideoRateModel.load(accountInstance.id, video.id, t)

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
        previousRate.url = getLocalRateUrl(rateType, account.Actor, video)
        await previousRate.save(sequelizeOptions)
      }
    } else if (rateType !== 'none') { // There was not a previous rate, insert a new one if there is a rate
      const query = {
        accountId: accountInstance.id,
        videoId: video.id,
        type: rateType,
        url: getLocalRateUrl(rateType, account.Actor, video)
      }

      await AccountVideoRateModel.create(query, sequelizeOptions)
    }

    const incrementQuery = {
      likes: likesToIncrement,
      dislikes: dislikesToIncrement
    }

    await video.increment(incrementQuery, sequelizeOptions)

    await sendVideoRateChange(accountInstance, video, likesToIncrement, dislikesToIncrement, t)
  })
}
