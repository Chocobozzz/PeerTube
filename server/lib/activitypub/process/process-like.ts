import { ActivityLike } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardActivity } from '../send/utils'
import { getOrCreateAccountAndVideoAndChannel } from '../videos'

async function processLikeActivity (activity: ActivityLike) {
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  return processLikeVideo(actor, activity)
}

// ---------------------------------------------------------------------------

export {
  processLikeActivity
}

// ---------------------------------------------------------------------------

async function processLikeVideo (actor: ActorModel, activity: ActivityLike) {
  const options = {
    arguments: [ actor, activity ],
    errorMessage: 'Cannot like the video with many retries.'
  }

  return retryTransactionWrapper(createVideoLike, options)
}

async function createVideoLike (byActor: ActorModel, activity: ActivityLike) {
  const videoUrl = activity.object

  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot create like with the non account actor ' + byActor.url)

  const { video } = await getOrCreateAccountAndVideoAndChannel(videoUrl)

  return sequelizeTypescript.transaction(async t => {
    const rate = {
      type: 'like' as 'like',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await AccountVideoRateModel.findOrCreate({
      where: rate,
      defaults: rate,
      transaction: t
    })
    if (created === true) await video.increment('likes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}
