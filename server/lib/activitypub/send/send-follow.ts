import { ActivityFollow } from '../../../../shared/models/activitypub'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getActorFollowActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { logger } from '../../../helpers/logger'
import { Transaction } from 'sequelize'
import { ActorModelOnly } from '../../../typings/models'

function sendFollow (actorFollow: ActorFollowModel, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send follow request to %s.', following.url)

  const url = getActorFollowActivityPubUrl(me, following)
  const data = buildFollowActivity(url, me, following)

  t.afterCommit(() => unicastTo(data, me, following.inboxUrl))
}

function buildFollowActivity (url: string, byActor: ActorModelOnly, targetActor: ActorModelOnly): ActivityFollow {
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
  buildFollowActivity
}
