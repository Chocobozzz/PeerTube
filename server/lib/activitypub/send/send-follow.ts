import { ActivityFollow } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowActivityPubUrl } from '../url'
import { unicastTo } from './utils'

function sendFollow (actorFollow: ActorFollowModel) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

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
