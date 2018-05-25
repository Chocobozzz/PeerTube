import { ActivityAnnounce } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardActivity } from '../send/utils'
import { getOrCreateAccountAndVideoAndChannel } from '../videos'

async function processAnnounceActivity (activity: ActivityAnnounce) {
  const actorAnnouncer = await getOrCreateActorAndServerAndModel(activity.actor)

  return processVideoShare(actorAnnouncer, activity)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

function processVideoShare (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const options = {
    arguments: [ actorAnnouncer, activity ],
    errorMessage: 'Cannot share the video activity with many retries.'
  }

  return retryTransactionWrapper(shareVideo, options)
}

async function shareVideo (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const objectUri = typeof activity.object === 'string' ? activity.object : activity.object.id
  let video: VideoModel

  const res = await getOrCreateAccountAndVideoAndChannel(objectUri)
  video = res.video

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
      await forwardActivity(activity, t, exceptions)
    }

    return undefined
  })
}
