import { MActorFollowActors } from '../../types/models'
import { CONFIG } from '../../initializers/config'
import { SERVER_ACTOR_NAME } from '../../initializers/constants'
import { JobQueue } from '../job-queue'
import { logger } from '../../helpers/logger'
import { ServerModel } from '../../models/server/server'
import { getServerActor } from '@server/models/application/application'

async function autoFollowBackIfNeeded (actorFollow: MActorFollowActors) {
  if (!CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_BACK.ENABLED) return

  const follower = actorFollow.ActorFollower

  if (follower.type === 'Application' && follower.preferredUsername === SERVER_ACTOR_NAME) {
    logger.info('Auto follow back %s.', follower.url)

    const me = await getServerActor()

    const server = await ServerModel.load(follower.serverId)
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
