import { Transaction } from 'sequelize'
import { ActivityFollow } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { MActor, MActorFollowActors } from '../../../types/models'
import { unicastTo } from './utils'

function sendFollow (actorFollow: MActorFollowActors, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send follow request to %s.', following.url)

  const data = buildFollowActivity(actorFollow.url, me, following)

  t.afterCommit(() => unicastTo(data, me, following.inboxUrl))
}

function buildFollowActivity (url: string, byActor: MActor, targetActor: MActor): ActivityFollow {
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
