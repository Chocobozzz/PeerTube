import { ActivityFollow, ActivityReject } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowAcceptActivityPubUrl, getActorFollowActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { buildFollowActivity } from './send-follow'
import { logger } from '../../../helpers/logger'

async function sendReject (actorFollow: ActorFollowModel) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending reject to local follower.')
    return
  }

  logger.info('Creating job to reject follower %s.', follower.url)

  const followUrl = getActorFollowActivityPubUrl(actorFollow)
  const followData = buildFollowActivity(followUrl, follower, me)

  const url = getActorFollowAcceptActivityPubUrl(actorFollow)
  const data = buildRejectActivity(url, me, followData)

  return unicastTo(data, me, follower.inboxUrl)
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
