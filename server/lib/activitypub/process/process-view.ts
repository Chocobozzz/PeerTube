import { VideoViews } from '@server/lib/video-views'
import { ActivityView } from '../../../../shared/models/activitypub'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateAPVideo } from '../videos'

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

  await VideoViews.Instance.processView({ video, ip: null, viewerExpires })

  if (video.isOwned()) {
    // Forward the view but don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}
