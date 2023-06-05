import { VideoModel } from '@server/models/video/video'
import { ActivityDislike } from '@shared/models'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { federateVideoIfNeeded, getOrCreateAPVideo } from '../videos'

async function processDislikeActivity (options: APProcessorOptions<ActivityDislike>) {
  const { activity, byActor } = options
  return retryTransactionWrapper(processDislike, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processDislikeActivity
}

// ---------------------------------------------------------------------------

async function processDislike (activity: ActivityDislike, byActor: MActorSignature) {
  const dislikeObject = activity.object
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video: onlyVideo } = await getOrCreateAPVideo({ videoObject: dislikeObject, fetchType: 'only-video' })

  // We don't care about dislikes of remote videos
  if (!onlyVideo.isOwned()) return

  return sequelizeTypescript.transaction(async t => {
    const video = await VideoModel.loadFull(onlyVideo.id, t)

    const existingRate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byAccount.id, video.id, activity.id, t)
    if (existingRate && existingRate.type === 'dislike') return

    await video.increment('dislikes', { transaction: t })
    video.dislikes++

    if (existingRate && existingRate.type === 'like') {
      await video.decrement('likes', { transaction: t })
      video.likes--
    }

    const rate = existingRate || new AccountVideoRateModel()
    rate.type = 'dislike'
    rate.videoId = video.id
    rate.accountId = byAccount.id
    rate.url = activity.id

    await rate.save({ transaction: t })

    await federateVideoIfNeeded(video, false, t)
  })
}
