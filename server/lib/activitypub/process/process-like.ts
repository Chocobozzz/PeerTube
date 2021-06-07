import { ActivityLike } from '../../../../shared/models/activitypub'
import { getAPId } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateAPVideo } from '../videos'

async function processLikeActivity (options: APProcessorOptions<ActivityLike>) {
  const { activity, byActor } = options
  return retryTransactionWrapper(processLikeVideo, byActor, activity)
}

// ---------------------------------------------------------------------------

export {
  processLikeActivity
}

// ---------------------------------------------------------------------------

async function processLikeVideo (byActor: MActorSignature, activity: ActivityLike) {
  const videoUrl = getAPId(activity.object)

  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot create like with the non account actor ' + byActor.url)

  const { video } = await getOrCreateAPVideo({ videoObject: videoUrl })

  return sequelizeTypescript.transaction(async t => {
    const existingRate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byAccount.id, video.id, activity.id, t)
    if (existingRate && existingRate.type === 'like') return

    if (existingRate && existingRate.type === 'dislike') {
      await video.decrement('dislikes', { transaction: t })
    }

    await video.increment('likes', { transaction: t })

    const rate = existingRate || new AccountVideoRateModel()
    rate.type = 'like'
    rate.videoId = video.id
    rate.accountId = byAccount.id
    rate.url = activity.id

    await rate.save({ transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}
