import { ActivityAnnounce, ActivityCreate } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardActivity } from '../send/misc'
import { processCreateActivity } from './process-create'

async function processAnnounceActivity (activity: ActivityAnnounce) {
  const announcedActivity = activity.object
  const actorAnnouncer = await getOrCreateActorAndServerAndModel(activity.actor)

  if (typeof announcedActivity === 'string') {
    return processVideoShare(actorAnnouncer, activity)
  } else if (announcedActivity.type === 'Create' && announcedActivity.object.type === 'Video') {
    return processVideoShare(actorAnnouncer, activity)
  }

  logger.warn(
    'Unknown activity object type %s -> %s when announcing activity.', announcedActivity.type, announcedActivity.object.type,
    { activity: activity.id }
  )

  return undefined
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

function shareVideo (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const announced = activity.object

  return sequelizeTypescript.transaction(async t => {
    // Add share entry
    let video: VideoModel

    if (typeof announced === 'string') {
      video = await VideoModel.loadByUrlAndPopulateAccount(announced)
      if (!video) throw new Error('Unknown video to share ' + announced)
    } else {
      video = await processCreateActivity(announced)
    }

    const share = {
      actorId: actorAnnouncer.id,
      videoId: video.id
    }

    const [ , created ] = await VideoShareModel.findOrCreate({
      where: share,
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
