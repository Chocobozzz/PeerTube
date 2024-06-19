import { ActivityAnnounce } from '@peertube/peertube-models'
import { getAPId } from '@server/lib/activitypub/activity.js'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature } from '../../../types/models/index.js'
import { Notifier } from '../../notifier/index.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { maybeGetOrCreateAPVideo } from '../videos/index.js'

async function processAnnounceActivity (options: APProcessorOptions<ActivityAnnounce>) {
  const { activity, byActor: actorAnnouncer } = options
  // Only notify if it is not from a fetcher job
  const notify = options.fromFetch !== true

  // Announces by accounts are not supported
  if (actorAnnouncer.type !== 'Application' && actorAnnouncer.type !== 'Group') return

  return retryTransactionWrapper(processVideoShare, actorAnnouncer, activity, notify)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

async function processVideoShare (actorAnnouncer: MActorSignature, activity: ActivityAnnounce, notify: boolean) {
  const objectUri = getAPId(activity.object)

  const { video, created: videoCreated } = await maybeGetOrCreateAPVideo({ videoObject: objectUri })
  if (!video) return

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

  if (videoCreated && notify) Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(video)
}
