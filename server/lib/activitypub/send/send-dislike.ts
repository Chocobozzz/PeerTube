import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityDislike } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { MActor, MActorAudience, MVideoAccountLight, MVideoUrl } from '../../../types/models'
import { audiencify, getAudience } from '../audience'
import { getVideoDislikeActivityPubUrlByLocalActor } from '../url'
import { sendVideoActivityToOrigin } from './shared/send-utils'

function sendDislike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to dislike %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoDislikeActivityPubUrlByLocalActor(byActor, video)

    return buildDislikeActivity(url, byActor, video, audience)
  }

  return sendVideoActivityToOrigin(activityBuilder, { byActor, video, transaction: t })
}

function buildDislikeActivity (url: string, byActor: MActorAudience, video: MVideoUrl, audience?: ActivityAudience): ActivityDislike {
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
