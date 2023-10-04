import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SERVER_ACTOR_NAME } from '../../initializers/constants.js'
import { ServerModel } from '../../models/server/server.js'
import { MActorFollowActors } from '../../types/models/index.js'
import { JobQueue } from '../job-queue/index.js'

async function autoFollowBackIfNeeded (actorFollow: MActorFollowActors, transaction?: Transaction) {
  if (!CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_BACK.ENABLED) return

  const follower = actorFollow.ActorFollower

  if (follower.type === 'Application' && follower.preferredUsername === SERVER_ACTOR_NAME) {
    logger.info('Auto follow back %s.', follower.url)

    const me = await getServerActor()

    const server = await ServerModel.load(follower.serverId, transaction)
    const host = server.host

    const payload = {
      host,
      name: SERVER_ACTOR_NAME,
      followerActorId: me.id,
      isAutoFollow: true
    }

    JobQueue.Instance.createJobAsync({ type: 'activitypub-follow', payload })
  }
}

// If we only have an host, use a default account handle
function getRemoteNameAndHost (handleOrHost: string) {
  let name = SERVER_ACTOR_NAME
  let host = handleOrHost

  const splitted = handleOrHost.split('@')
  if (splitted.length === 2) {
    name = splitted[0]
    host = splitted[1]
  }

  return { name, host }
}

export {
  autoFollowBackIfNeeded,
  getRemoteNameAndHost
}
