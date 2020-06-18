import { ActivityCreate, ActivityDislike } from '../../../../shared'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getVideoDislikeActivityPubUrl } from '../url'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'

async function processDislikeActivity (options: APProcessorOptions<ActivityCreate | ActivityDislike>) {
  const { activity, byActor } = options
  return retryTransactionWrapper(processDislike, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processDislikeActivity
}

// ---------------------------------------------------------------------------

async function processDislike (activity: ActivityCreate | ActivityDislike, byActor: MActorSignature) {
  const dislikeObject = activity.type === 'Dislike' ? activity.object : (activity.object as DislikeObject).object
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: dislikeObject })

  return sequelizeTypescript.transaction(async t => {
    const url = getVideoDislikeActivityPubUrl(byActor, video)

    const existingRate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byAccount.id, video.id, url)
    if (existingRate && existingRate.type === 'dislike') return

    await video.increment('dislikes', { transaction: t })

    if (existingRate && existingRate.type === 'like') {
      await video.decrement('likes', { transaction: t })
    }

    const rate = existingRate || new AccountVideoRateModel()
    rate.type = 'dislike'
    rate.videoId = video.id
    rate.accountId = byAccount.id
    rate.url = url

    await rate.save({ transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}
