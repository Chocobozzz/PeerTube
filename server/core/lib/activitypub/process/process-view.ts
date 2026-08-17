import { ActivityView } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { MAX_REMOTE_VIEWERS_COUNTER } from '@server/initializers/constants.js'
import { VideoStatsManager } from '@server/lib/stats/video-stats-manager.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature, MVideo } from '../../../types/models/index.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { checkUrlsSameHost } from '../url.js'
import { getOrCreateAPVideo } from '../videos/index.js'

const logger = createLogger('ap', 'view')

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

  // The view URL is built from the actor URL, so don't accept a view of another host
  if (checkUrlsSameHost(activity.id, byActor.url) !== true) {
    logger.warn('Ignoring view %s that has not the same host than actor %s.', activity.id, byActor.url)
    return
  }

  const { video } = await getOrCreateAPVideo({
    videoObject,
    fetchType: 'with-blacklist',
    allowRefresh: false
  })

  const isNew = await VideoStatsManager.Instance.processRemoteView({
    video,
    viewerId: activity.id,

    viewerExpires: activity.expires
      ? new Date(activity.expires)
      : undefined,
    viewerResultCounter: getViewerResultCounter(activity, video, byActor)
  })

  // Only forward a view we didn't already know, so a replayed activity can't be amplified to all our followers
  if (isNew && video.isLocal()) {
    // Forward the view but don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity({ activity, transaction: undefined, followersException: exceptions, video, parallelizable: true })
  }
}

function getViewerResultCounter (activity: ActivityView, video: MVideo, byActor: MActorSignature) {
  const result = activity.result

  if (!activity.expires || result?.interactionType !== 'WatchAction' || result?.type !== 'InteractionCounter') return undefined

  // Only the origin instance of the video can send us a summary of all its viewers
  if (!checkUrlsSameHost(byActor.url, video.url)) return undefined

  const counter = parseInt(result.userInteractionCount + '')
  if (isNaN(counter)) return undefined

  return Math.min(Math.max(counter, 0), MAX_REMOTE_VIEWERS_COUNTER)
}
