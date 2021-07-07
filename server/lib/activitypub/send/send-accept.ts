import { ActivityAccept, ActivityFollow } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { MActor, MActorFollowActors } from '../../../types/models'
import { getLocalActorFollowAcceptActivityPubUrl } from '../url'
import { buildFollowActivity } from './send-follow'
import { unicastTo } from './utils'

function sendAccept (actorFollow: MActorFollowActors) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending accept to local follower.')
    return
  }

  logger.info('Creating job to accept follower %s.', follower.url)

  const followData = buildFollowActivity(actorFollow.url, follower, me)

  const url = getLocalActorFollowAcceptActivityPubUrl(actorFollow)
  const data = buildAcceptActivity(url, me, followData)

  return unicastTo(data, me, follower.inboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendAccept
}

// ---------------------------------------------------------------------------

function buildAcceptActivity (url: string, byActor: MActor, followActivityData: ActivityFollow): ActivityAccept {
  return {
    type: 'Accept',
    id: url,
    actor: byActor.url,
    object: followActivityData
  }
}
