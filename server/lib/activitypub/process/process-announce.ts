import { ActivityAnnounce } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoShareModel } from '../../../models/video/video-share'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { Notifier } from '../../notifier'
import { logger } from '../../../helpers/logger'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature, MVideoAccountLightBlacklistAllFiles } from '../../../types/models'

async function processAnnounceActivity (options: APProcessorOptions<ActivityAnnounce>) {
  const { activity, byActor: actorAnnouncer } = options
  // Only notify if it is not from a fetcher job
  const notify = options.fromFetch !== true

  return retryTransactionWrapper(processVideoShare, actorAnnouncer, activity, notify)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

async function processVideoShare (actorAnnouncer: MActorSignature, activity: ActivityAnnounce, notify: boolean) {
  const objectUri = typeof activity.object === 'string' ? activity.object : activity.object.id

  let video: MVideoAccountLightBlacklistAllFiles
  let videoCreated: boolean

  try {
    const result = await getOrCreateVideoAndAccountAndChannel({ videoObject: objectUri })
    video = result.video
    videoCreated = result.created
  } catch (err) {
    logger.debug('Cannot process share of %s. Maybe this is not a video object, so just skipping.', objectUri, { err })
    return
  }

  await sequelizeTypescript.transaction(async t => {
    // Add share entry

    const share = {
      actorId: actorAnnouncer.id,
      videoId: video.id,
      url: activity.id
    }

    const [ , created ] = await VideoShareModel.findOrCreate({
      where: {
        url: activity.id
      },
      defaults: share,
      transaction: t
    })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ actorAnnouncer ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }

    return undefined
  })

  if (videoCreated && notify) Notifier.Instance.notifyOnNewVideoIfNeeded(video)
}
