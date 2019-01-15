import { ActivityLike } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { getVideoLikeActivityPubUrl } from '../url'
import { getAPId } from '../../../helpers/activitypub'

async function processLikeActivity (activity: ActivityLike, byActor: ActorModel) {
  return retryTransactionWrapper(processLikeVideo, byActor, activity)
}

// ---------------------------------------------------------------------------

export {
  processLikeActivity
}

// ---------------------------------------------------------------------------

async function processLikeVideo (byActor: ActorModel, activity: ActivityLike) {
  const videoUrl = getAPId(activity.object)

  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot create like with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoUrl })

  return sequelizeTypescript.transaction(async t => {
    const rate = {
      type: 'like' as 'like',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await AccountVideoRateModel.findOrCreate({
      where: rate,
      defaults: Object.assign({}, rate, { url: getVideoLikeActivityPubUrl(byActor, video) }),
      transaction: t
    })
    if (created === true) await video.increment('likes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}
