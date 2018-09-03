import { ActivityFollow } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { logger } from '../../../helpers/logger'

function sendFollow (actorFollow: ActorFollowModel) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send follow request to %s.', following.url)

  const url = getActorFollowActivityPubUrl(actorFollow)
  const data = followActivityData(url, me, following)

  return unicastTo(data, me, following.inboxUrl)
}

function followActivityData (url: string, byActor: ActorModel, targetActor: ActorModel): ActivityFollow {
  return {
    type: 'Follow',
    id: url,
    actor: byActor.url,
    object: targetActor.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendFollow,
  followActivityData
}
