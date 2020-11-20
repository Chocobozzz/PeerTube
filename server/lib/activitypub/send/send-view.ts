import { Transaction } from 'sequelize'
import { MActorAudience, MVideoImmutable, MVideoUrl } from '@server/types/models'
import { ActivityAudience, ActivityView } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { audiencify, getAudience } from '../audience'
import { getLocalVideoViewActivityPubUrl } from '../url'
import { sendVideoRelatedActivity } from './utils'

async function sendView (byActor: ActorModel, video: MVideoImmutable, t: Transaction) {
  logger.info('Creating job to send view of %s.', video.url)

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getLocalVideoViewActivityPubUrl(byActor, video)

    return buildViewActivity(url, byActor, video, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction: t, contextType: 'View' })
}

function buildViewActivity (url: string, byActor: MActorAudience, video: MVideoUrl, audience?: ActivityAudience): ActivityView {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      id: url,
      type: 'View' as 'View',
      actor: byActor.url,
      object: video.url
    },
    audience
  )
}

// ---------------------------------------------------------------------------

export {
  sendView
}
