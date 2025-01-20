import { ActivityAudience, ActivityView } from '@peertube/peertube-models'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { MActorAudience, MActorLight, MVideoImmutable, MVideoUrl } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger.js'
import { audiencify, getAudience } from '../audience.js'
import { getLocalVideoViewActivityPubUrl } from '../url.js'
import { sendVideoRelatedActivity } from './shared/send-utils.js'

async function sendView (options: {
  byActor: MActorLight
  video: MVideoImmutable
  viewerIdentifier: string
  viewersCount?: number
  transaction?: Transaction
}) {
  const { byActor, viewersCount, video, viewerIdentifier, transaction } = options

  logger.info('Creating job to send %s of %s.', viewersCount !== undefined ? 'viewer' : 'view', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getLocalVideoViewActivityPubUrl(byActor, video, viewerIdentifier)

    return buildViewActivity({ url, byActor, video, audience, viewersCount })
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction, contextType: 'View', parallelizable: true })
}

// ---------------------------------------------------------------------------

export {
  sendView
}

// ---------------------------------------------------------------------------

function buildViewActivity (options: {
  url: string
  byActor: MActorAudience
  video: MVideoUrl
  viewersCount?: number
  audience?: ActivityAudience
}): ActivityView {
  const { url, byActor, viewersCount, video, audience = getAudience(byActor) } = options

  const base = {
    id: url,
    type: 'View' as 'View',
    actor: byActor.url,
    object: video.url
  }

  if (viewersCount === undefined) {
    return audiencify(base, audience)
  }

  return audiencify({
    ...base,

    expires: new Date(VideoViewsManager.Instance.buildViewerExpireTime()).toISOString(),

    result: {
      interactionType: 'WatchAction',
      type: 'InteractionCounter',
      userInteractionCount: viewersCount
    }
  }, audience)
}
