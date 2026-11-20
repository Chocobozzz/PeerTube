import { arrayify } from '@peertube/peertube-core-utils'
import { ActivityFollow, APObjectId } from '@peertube/peertube-models'
import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application.js'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { SERVER_ACTOR_NAME } from '../../initializers/constants.js'
import { ServerModel } from '../../models/server/server.js'
import { MActorFollowActors, MActorUrl } from '../../types/models/index.js'
import { JobQueue } from '../job-queue/index.js'
import { getAPId } from './activity.js'

const logger = createLogger()

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

// Accept/Reject activities can also answer other activities (approval of a reply, a like...)
// Check the answered activity is the follow of follower -> following
function isActivityObjectTheFollow (options: {
  object: APObjectId | ActivityFollow
  // URL of the follow, if we know it
  followUrl: string
  follower: MActorUrl
  following: MActorUrl
}) {
  const { object, followUrl, follower, following } = options

  if (!object) return false

  // Only an id: we can only compare it to the follow URL
  if (typeof object === 'string') return object === followUrl

  const objectTypes = arrayify((object as { type?: string | string[] }).type)
  if (objectTypes.length !== 0 && !objectTypes.includes('Follow')) return false

  if (followUrl && getAPId(object) === followUrl) return true

  // Some implementations (relays, Mastodon...) can answer with a follow id that is not the one we have
  // Fallback on the follow actor and object
  const embeddedFollow = object as ActivityFollow
  if (!embeddedFollow.actor || !embeddedFollow.object) return false

  return getAPId(embeddedFollow.actor) === follower.url && getAPId(embeddedFollow.object) === following.url
}

export {
  autoFollowBackIfNeeded,
  getRemoteNameAndHost,
  isActivityObjectTheFollow
}
