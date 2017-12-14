import { Transaction } from 'sequelize'
import { ActivityAccept } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowAcceptActivityPubUrl } from '../url'
import { unicastTo } from './misc'

async function sendAccept (actorFollow: ActorFollowModel, t: Transaction) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  const url = getActorFollowAcceptActivityPubUrl(actorFollow)
  const data = acceptActivityData(url, me)

  return unicastTo(data, me, follower.inboxUrl, t)
}

// ---------------------------------------------------------------------------

export {
  sendAccept
}

// ---------------------------------------------------------------------------

function acceptActivityData (url: string, byActor: ActorModel): ActivityAccept {
  return {
    type: 'Accept',
    id: url,
    actor: byActor.url
  }
}
