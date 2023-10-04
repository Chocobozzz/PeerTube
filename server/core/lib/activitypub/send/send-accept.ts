import { ActivityAccept, ActivityFollow } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MActor, MActorFollowActors } from '../../../types/models/index.js'
import { getLocalActorFollowAcceptActivityPubUrl } from '../url.js'
import { buildFollowActivity } from './send-follow.js'
import { unicastTo } from './shared/send-utils.js'

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

  return unicastTo({
    data,
    byActor: me,
    toActorUrl: follower.inboxUrl,
    contextType: 'Accept'
  })
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
