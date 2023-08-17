import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MActor, MActorAudience, MVideoAccountLight, MVideoUrl } from '../../../types/models/index.js'
import { audiencify, getAudience } from '../audience.js'
import { getVideoLikeActivityPubUrlByLocalActor } from '../url.js'
import { sendVideoActivityToOrigin } from './shared/send-utils.js'

function sendLike (byActor: MActor, video: MVideoAccountLight, transaction: Transaction) {
  logger.info('Creating job to like %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoLikeActivityPubUrlByLocalActor(byActor, video)

    return buildLikeActivity(url, byActor, video, audience)
  }

  return sendVideoActivityToOrigin(activityBuilder, { byActor, video, transaction, contextType: 'Rate' })
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
