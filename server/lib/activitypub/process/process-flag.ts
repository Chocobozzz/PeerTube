import { ActivityCreate, ActivityFlag, VideoAbuseState } from '../../../../shared'
import { VideoAbuseObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'

async function processFlagActivity (activity: ActivityCreate | ActivityFlag, byActor: ActorModel) {
  return retryTransactionWrapper(processCreateVideoAbuse, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processFlagActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideoAbuse (activity: ActivityCreate | ActivityFlag, byActor: ActorModel) {
  const flag = activity.type === 'Flag' ? activity : (activity.object as VideoAbuseObject)

  logger.debug('Reporting remote abuse for video %s.', getAPId(flag.object))

  const account = byActor.Account
  if (!account) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: flag.object })

  return sequelizeTypescript.transaction(async t => {
    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: flag.content,
      videoId: video.id,
      state: VideoAbuseState.PENDING
    }

    const videoAbuseInstance = await VideoAbuseModel.create(videoAbuseData, { transaction: t })
    videoAbuseInstance.Video = video

    Notifier.Instance.notifyOnNewVideoAbuse(videoAbuseInstance)

    logger.info('Remote abuse for video uuid %s created', flag.object)
  })
}
