import { ActivityCreate, ActivityFlag, VideoAbuseState } from '../../../../shared'
import { VideoAbuseObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'
import { APProcessorOptions } from '../../../typings/activitypub-processor.model'
import { MActorSignature, MVideoAbuseVideo } from '../../../typings/models'

async function processFlagActivity (options: APProcessorOptions<ActivityCreate | ActivityFlag>) {
  const { activity, byActor } = options
  return retryTransactionWrapper(processCreateVideoAbuse, activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processFlagActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideoAbuse (activity: ActivityCreate | ActivityFlag, byActor: MActorSignature) {
  const flag = activity.type === 'Flag' ? activity : (activity.object as VideoAbuseObject)

  logger.debug('Reporting remote abuse for video %s.', getAPId(flag.object))

  const account = byActor.Account
  if (!account) throw new Error('Cannot create video abuse with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: flag.object })

  const videoAbuse = await sequelizeTypescript.transaction(async t => {
    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: flag.content,
      videoId: video.id,
      state: VideoAbuseState.PENDING
    }

    const videoAbuseInstance = await VideoAbuseModel.create(videoAbuseData, { transaction: t }) as MVideoAbuseVideo
    videoAbuseInstance.Video = video

    logger.info('Remote abuse for video uuid %s created', flag.object)

    return videoAbuseInstance
  })

  Notifier.Instance.notifyOnNewVideoAbuse(videoAbuse)
}
