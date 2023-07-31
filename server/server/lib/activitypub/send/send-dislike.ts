import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityDislike } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MActor, MActorAudience, MVideoAccountLight, MVideoUrl } from '../../../types/models/index.js'
import { audiencify, getAudience } from '../audience.js'
import { getVideoDislikeActivityPubUrlByLocalActor } from '../url.js'
import { sendVideoActivityToOrigin } from './shared/send-utils.js'

function sendDislike (byActor: MActor, video: MVideoAccountLight, transaction: Transaction) {
  logger.info('Creating job to dislike %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getVideoDislikeActivityPubUrlByLocalActor(byActor, video)

    return buildDislikeActivity(url, byActor, video, audience)
  }

  return sendVideoActivityToOrigin(activityBuilder, { byActor, video, transaction, contextType: 'Rate' })
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
