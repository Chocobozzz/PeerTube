import { ActivityAnnounce } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoShareModel } from '../../../models/video/video-share'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { Notifier } from '../../notifier'

async function processAnnounceActivity (activity: ActivityAnnounce, actorAnnouncer: ActorModel) {
  return retryTransactionWrapper(processVideoShare, actorAnnouncer, activity)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

async function processVideoShare (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const objectUri = typeof activity.object === 'string' ? activity.object : activity.object.id

  const { video, created: videoCreated } = await getOrCreateVideoAndAccountAndChannel({ videoObject: objectUri })

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

  if (videoCreated) Notifier.Instance.notifyOnNewVideo(video)
}
