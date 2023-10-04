import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { ActivityView } from '@peertube/peertube-models'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature } from '../../../types/models/index.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { getOrCreateAPVideo } from '../videos/index.js'

async function processViewActivity (options: APProcessorOptions<ActivityView>) {
  const { activity, byActor } = options

  return processCreateView(activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processViewActivity
}

// ---------------------------------------------------------------------------

async function processCreateView (activity: ActivityView, byActor: MActorSignature) {
  const videoObject = activity.object

  const { video } = await getOrCreateAPVideo({
    videoObject,
    fetchType: 'only-video',
    allowRefresh: false
  })

  const viewerExpires = activity.expires
    ? new Date(activity.expires)
    : undefined

  await VideoViewsManager.Instance.processRemoteView({ video, viewerId: activity.id, viewerExpires })

  if (video.isOwned()) {
    // Forward the view but don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}
