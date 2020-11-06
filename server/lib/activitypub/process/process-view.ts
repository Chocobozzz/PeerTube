import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { Redis } from '../../redis'
import { ActivityCreate, ActivityView, ViewObject } from '../../../../shared/models/activitypub'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { LiveManager } from '@server/lib/live-manager'

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
  const videoObject = activity.type === 'View'
    ? activity.object
    : (activity.object as ViewObject).object

  const options = {
    videoObject,
    fetchType: 'only-video' as 'only-video',
    allowRefresh: false as false
  }
  const { video } = await getOrCreateVideoAndAccountAndChannel(options)

  if (!video.isLive) {
    await Redis.Instance.addVideoView(video.id)
  }

  if (video.isOwned()) {
    // Our live manager will increment the counter and send the view to followers
    if (video.isLive) {
      LiveManager.Instance.addViewTo(video.id)
      return
    }

    // Forward the view but don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}
