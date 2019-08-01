import { ActivityCreate, ActivityDislike } from '../../../../shared'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getVideoDislikeActivityPubUrl } from '../url'

async function processDislikeActivity (activity: ActivityCreate | ActivityDislike, byActor: ActorModel) {
  return retryTransactionWrapper(processDislike, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processDislikeActivity
}

// ---------------------------------------------------------------------------

async function processDislike (activity: ActivityCreate | ActivityDislike, byActor: ActorModel) {
  const dislikeObject = activity.type === 'Dislike' ? activity.object : (activity.object as DislikeObject).object
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: dislikeObject })

  return sequelizeTypescript.transaction(async t => {
    const url = getVideoDislikeActivityPubUrl(byActor, video)

    const existingRate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byAccount.id, video.id, url)
    if (existingRate && existingRate.type === 'dislike') return

    await AccountVideoRateModel.create({
      type: 'dislike' as 'dislike',
      videoId: video.id,
      accountId: byAccount.id,
      url
    }, { transaction: t })

    await video.increment('dislikes', { transaction: t })

    if (existingRate && existingRate.type === 'like') {
      await video.decrement('likes', { transaction: t })
    }

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}
