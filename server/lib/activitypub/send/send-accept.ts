import { ActivityAccept, ActivityFollow } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowAcceptActivityPubUrl, getActorFollowActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { followActivityData } from './send-follow'
import { logger } from '../../../helpers/logger'

async function sendAccept (actorFollow: ActorFollowModel) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending accept to local follower.')
    return
  }

  logger.info('Creating job to accept follower %s.', follower.url)

  const followUrl = getActorFollowActivityPubUrl(actorFollow)
  const followData = followActivityData(followUrl, follower, me)

  const url = getActorFollowAcceptActivityPubUrl(actorFollow)
  const data = acceptActivityData(url, me, followData)

  return unicastTo(data, me, follower.inboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendAccept
}

// ---------------------------------------------------------------------------

function acceptActivityData (url: string, byActor: ActorModel, followActivityData: ActivityFollow): ActivityAccept {
  return {
    type: 'Accept',
    id: url,
    actor: byActor.url,
    object: followActivityData
  }
}
