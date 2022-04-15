import { Transaction } from 'sequelize'
import { ActivityFollow } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { MActor, MActorFollowActors } from '../../../types/models'
import { unicastTo } from './shared/send-utils'

function sendFollow (actorFollow: MActorFollowActors, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send follow request to %s.', following.url)

  const data = buildFollowActivity(actorFollow.url, me, following)

  return t.afterCommit(() => {
    return unicastTo({ data, byActor: me, toActorUrl: following.inboxUrl, contextType: 'Follow' })
  })
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
