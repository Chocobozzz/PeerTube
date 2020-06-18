import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { REMOTE_SCHEME, WEBSERVER } from '../../../initializers/constants'
import { sendFollow } from '../../activitypub/send'
import { sanitizeHost } from '../../../helpers/core-utils'
import { loadActorUrlOrGetFromWebfinger } from '../../../helpers/webfinger'
import { getOrCreateActorAndServerAndModel } from '../../activitypub/actor'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { ActorModel } from '../../../models/activitypub/actor'
import { Notifier } from '../../notifier'
import { sequelizeTypescript } from '../../../initializers/database'
import { MActor, MActorFollowActors, MActorFull } from '../../../types/models'
import { ActivitypubFollowPayload } from '@shared/models'

async function processActivityPubFollow (job: Bull.Job) {
  const payload = job.data as ActivitypubFollowPayload
  const host = payload.host

  logger.info('Processing ActivityPub follow in job %d.', job.id)

  let targetActor: MActorFull
  if (!host || host === WEBSERVER.HOST) {
    targetActor = await ActorModel.loadLocalByName(payload.name)
  } else {
    const sanitizedHost = sanitizeHost(host, REMOTE_SCHEME.HTTP)
    const actorUrl = await loadActorUrlOrGetFromWebfinger(payload.name + '@' + sanitizedHost)
    targetActor = await getOrCreateActorAndServerAndModel(actorUrl, 'all')
  }

  if (payload.assertIsChannel && !targetActor.VideoChannel) {
    logger.warn('Do not follow %s@%s because it is not a channel.', payload.name, host)
    return
  }

  const fromActor = await ActorModel.load(payload.followerActorId)

  return retryTransactionWrapper(follow, fromActor, targetActor, payload.isAutoFollow)
}
// ---------------------------------------------------------------------------

export {
  processActivityPubFollow
}

// ---------------------------------------------------------------------------

async function follow (fromActor: MActor, targetActor: MActorFull, isAutoFollow = false) {
  if (fromActor.id === targetActor.id) {
    throw new Error('Follower is the same as target actor.')
  }

  // Same server, direct accept
  const state = !fromActor.serverId && !targetActor.serverId ? 'accepted' : 'pending'

  const actorFollow = await sequelizeTypescript.transaction(async t => {
    const [ actorFollow ] = await ActorFollowModel.findOrCreate<MActorFollowActors>({
      where: {
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      defaults: {
        state,
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      transaction: t
    })
    actorFollow.ActorFollowing = targetActor
    actorFollow.ActorFollower = fromActor

    // Send a notification to remote server if our follow is not already accepted
    if (actorFollow.state !== 'accepted') sendFollow(actorFollow, t)

    return actorFollow
  })

  const followerFull = await ActorModel.loadFull(fromActor.id)

  const actorFollowFull = Object.assign(actorFollow, {
    ActorFollowing: targetActor,
    ActorFollower: followerFull
  })

  if (actorFollow.state === 'accepted') Notifier.Instance.notifyOfNewUserFollow(actorFollowFull)
  if (isAutoFollow === true) Notifier.Instance.notifyOfAutoInstanceFollowing(actorFollowFull)

  return actorFollow
}
