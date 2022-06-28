import { VideoModel } from '@server/models/video/video'
import { ActivityLike } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { getAPId } from '../../../lib/activitypub/activity'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { federateVideoIfNeeded, getOrCreateAPVideo } from '../videos'

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

  const { video: onlyVideo } = await getOrCreateAPVideo({ videoObject: videoUrl, fetchType: 'only-video' })

  // We don't care about likes of remote videos
  if (!onlyVideo.isOwned()) return

  return sequelizeTypescript.transaction(async t => {
    const video = await VideoModel.loadFull(onlyVideo.id, t)

    const existingRate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byAccount.id, video.id, activity.id, t)
    if (existingRate && existingRate.type === 'like') return

    if (existingRate && existingRate.type === 'dislike') {
      await video.decrement('dislikes', { transaction: t })
      video.dislikes--
    }

    await video.increment('likes', { transaction: t })
    video.likes++

    const rate = existingRate || new AccountVideoRateModel()
    rate.type = 'like'
    rate.videoId = video.id
    rate.accountId = byAccount.id
    rate.url = activity.id

    await rate.save({ transaction: t })

    await federateVideoIfNeeded(video, false, t)
  })
}
