import { ActivityAnnounce } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'

async function processAnnounceActivity (activity: ActivityAnnounce) {
  const actorAnnouncer = await getOrCreateActorAndServerAndModel(activity.actor)

  return retryTransactionWrapper(processVideoShare, actorAnnouncer, activity)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

async function processVideoShare (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const objectUri = typeof activity.object === 'string' ? activity.object : activity.object.id

  const { video } = await getOrCreateVideoAndAccountAndChannel(objectUri)

  return sequelizeTypescript.transaction(async t => {
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
}
