import { Transaction } from 'sequelize'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { getVideoDislikeActivityPubUrl } from '../url'
import { logger } from '../../../helpers/logger'
import { ActivityAudience, ActivityDislike } from '../../../../shared/models/activitypub'
import { sendVideoRelatedActivity } from './utils'
import { audiencify, getAudience } from '../audience'

async function sendDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to dislike %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoDislikeActivityPubUrl(byActor, video)

    return buildDislikeActivity(url, byActor, video, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction: t })
}

function buildDislikeActivity (url: string, byActor: ActorModel, video: VideoModel, audience?: ActivityAudience): ActivityDislike {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      id: url,
      type: 'Dislike' as 'Dislike',
      actor: byActor.url,
      object: video.url
    },
    audience
  )
}

// ---------------------------------------------------------------------------

export {
  sendDislike,
  buildDislikeActivity
}
