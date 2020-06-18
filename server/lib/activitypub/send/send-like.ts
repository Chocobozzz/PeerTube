import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub'
import { getVideoLikeActivityPubUrl } from '../url'
import { sendVideoRelatedActivity } from './utils'
import { audiencify, getAudience } from '../audience'
import { logger } from '../../../helpers/logger'
import { MActor, MActorAudience, MVideoAccountLight, MVideoUrl } from '../../../types/models'

function sendLike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to like %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoLikeActivityPubUrl(byActor, video)

    return buildLikeActivity(url, byActor, video, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction: t })
}

function buildLikeActivity (url: string, byActor: MActorAudience, video: MVideoUrl, audience?: ActivityAudience): ActivityLike {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      id: url,
      type: 'Like' as 'Like',
      actor: byActor.url,
      object: video.url
    },
    audience
  )
}

// ---------------------------------------------------------------------------

export {
  sendLike,
  buildLikeActivity
}
