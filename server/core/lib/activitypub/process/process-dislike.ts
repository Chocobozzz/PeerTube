import { ActivityDislike } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { VideoModel } from '@server/models/video/video.js'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature } from '../../../types/models/index.js'
import { canVideoBeFederated, federateVideoIfNeeded, maybeGetOrCreateAPVideo } from '../videos/index.js'

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
  const videoUrl = activity.object
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video: onlyVideo } = await maybeGetOrCreateAPVideo({ videoObject: videoUrl, fetchType: 'only-video-and-blacklist' })
  if (!onlyVideo?.isOwned()) return

  if (!canVideoBeFederated(onlyVideo)) {
    logger.warn(`Do not process dislike on video ${videoUrl} that cannot be federated`)
    return
  }

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
