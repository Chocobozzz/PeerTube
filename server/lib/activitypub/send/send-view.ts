import { Transaction } from 'sequelize'
import { VideoViewsManager } from '@server/lib/views/video-views-manager'
import { MActorAudience, MActorLight, MVideoImmutable, MVideoUrl } from '@server/types/models'
import { ActivityAudience, ActivityView } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { audiencify, getAudience } from '../audience'
import { getLocalVideoViewActivityPubUrl } from '../url'
import { sendVideoRelatedActivity } from './shared/send-utils'

type ViewType = 'view' | 'viewer'

async function sendView (options: {
  byActor: MActorLight
  type: ViewType
  video: MVideoImmutable
  viewerIdentifier: string
  transaction?: Transaction
}) {
  const { byActor, type, video, viewerIdentifier, transaction } = options

  logger.info('Creating job to send %s of %s.', type, video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getLocalVideoViewActivityPubUrl(byActor, video, viewerIdentifier)

    return buildViewActivity({ url, byActor, video, audience, type })
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
  type: ViewType
  audience?: ActivityAudience
}): ActivityView {
  const { url, byActor, type, video, audience = getAudience(byActor) } = options

  return audiencify(
    {
      id: url,
      type: 'View' as 'View',
      actor: byActor.url,
      object: video.url,

      expires: type === 'viewer'
        ? new Date(VideoViewsManager.Instance.buildViewerExpireTime()).toISOString()
        : undefined
    },
    audience
  )
}
