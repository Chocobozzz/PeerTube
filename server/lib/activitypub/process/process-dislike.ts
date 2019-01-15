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
    const rate = {
      type: 'dislike' as 'dislike',
      videoId: video.id,
      accountId: byAccount.id
    }

    const [ , created ] = await AccountVideoRateModel.findOrCreate({
      where: rate,
      defaults: Object.assign({}, rate, { url: getVideoDislikeActivityPubUrl(byActor, video) }),
      transaction: t
    })
    if (created === true) await video.increment('dislikes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}
