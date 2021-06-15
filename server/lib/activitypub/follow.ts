import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { SERVER_ACTOR_NAME } from '../../initializers/constants'
import { ServerModel } from '../../models/server/server'
import { MActorFollowActors } from '../../types/models'
import { JobQueue } from '../job-queue'

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

    JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
  }
}

export {
  autoFollowBackIfNeeded
}
