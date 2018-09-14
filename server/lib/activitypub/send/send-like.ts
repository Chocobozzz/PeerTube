import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { getVideoLikeActivityPubUrl } from '../url'
import { sendVideoRelatedActivity } from './utils'
import { audiencify, getAudience } from '../audience'
import { logger } from '../../../helpers/logger'

async function sendLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to like %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoLikeActivityPubUrl(byActor, video)

    return buildLikeActivity(url, byActor, video, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction: t })
}

function buildLikeActivity (url: string, byActor: ActorModel, video: VideoModel, audience?: ActivityAudience): ActivityLike {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Like' as 'Like',
      id: url,
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
