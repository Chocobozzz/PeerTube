import { ActorModel } from '../../../models/activitypub/actor'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { Redis } from '../../redis'
import { ActivityCreate, ActivityView, ViewObject } from '../../../../shared/models/activitypub'

async function processViewActivity (activity: ActivityView | ActivityCreate, byActor: ActorModel) {
  return processCreateView(activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processViewActivity
}

// ---------------------------------------------------------------------------

async function processCreateView (activity: ActivityView | ActivityCreate, byActor: ActorModel) {
  const videoObject = activity.type === 'View' ? activity.object : (activity.object as ViewObject).object

  const options = {
    videoObject: videoObject,
    fetchType: 'only-video' as 'only-video'
  }
  const { video } = await getOrCreateVideoAndAccountAndChannel(options)

  await Redis.Instance.addVideoView(video.id)

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}
