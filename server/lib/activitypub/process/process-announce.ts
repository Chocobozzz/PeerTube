import { ActivityAnnounce } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardActivity } from '../send/misc'
import { getOrCreateAccountAndVideoAndChannel } from '../videos'
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

async function shareVideo (actorAnnouncer: ActorModel, activity: ActivityAnnounce) {
  const announced = activity.object
  let video: VideoModel

  if (typeof announced === 'string') {
    const res = await getOrCreateAccountAndVideoAndChannel(announced)
    video = res.video
  } else {
    video = await processCreateActivity(announced)
  }

  return sequelizeTypescript.transaction(async t => {
    // Add share entry

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
