import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { Redis } from '../../redis'
import { ActivityCreate, ActivityView, ViewObject } from '../../../../shared/models/activitypub'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'

async function processViewActivity (options: APProcessorOptions<ActivityCreate | ActivityView>) {
  const { activity, byActor } = options
  return processCreateView(activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processViewActivity
}

// ---------------------------------------------------------------------------

async function processCreateView (activity: ActivityView | ActivityCreate, byActor: MActorSignature) {
  const videoObject = activity.type === 'View' ? activity.object : (activity.object as ViewObject).object

  const options = {
    videoObject,
    fetchType: 'only-immutable-attributes' as 'only-immutable-attributes',
    allowRefresh: false as false
  }
  const { video } = await getOrCreateVideoAndAccountAndChannel(options)

  await Redis.Instance.addVideoView(video.id)

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}
