import { ActivityFollow, ActivityReject } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { getActorFollowActivityPubUrl, getActorFollowRejectActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { buildFollowActivity } from './send-follow'
import { logger } from '../../../helpers/logger'
import { SignatureActorModel } from '../../../typings/models'

async function sendReject (follower: SignatureActorModel, following: ActorModel) {
  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending reject to local follower.')
    return
  }

  logger.info('Creating job to reject follower %s.', follower.url)

  const followUrl = getActorFollowActivityPubUrl(follower, following)
  const followData = buildFollowActivity(followUrl, follower, following)

  const url = getActorFollowRejectActivityPubUrl(follower, following)
  const data = buildRejectActivity(url, following, followData)

  return unicastTo(data, following, follower.inboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendReject
}

// ---------------------------------------------------------------------------

function buildRejectActivity (url: string, byActor: ActorModel, followActivityData: ActivityFollow): ActivityReject {
  return {
    type: 'Reject',
    id: url,
    actor: byActor.url,
    object: followActivityData
  }
}
