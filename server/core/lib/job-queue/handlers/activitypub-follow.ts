import { Job } from 'bullmq'
import { getLocalActorFollowActivityPubUrl } from '@server/lib/activitypub/url.js'
import { ActivitypubFollowPayload } from '@peertube/peertube-models'
import { sanitizeHost } from '../../../helpers/core-utils.js'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { logger } from '../../../helpers/logger.js'
import { REMOTE_SCHEME, SERVER_ACTOR_NAME, WEBSERVER } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { MActor, MActorFull } from '../../../types/models/index.js'
import { getOrCreateAPActor, loadActorUrlOrGetFromWebfinger } from '../../activitypub/actors/index.js'
import { sendFollow } from '../../activitypub/send/index.js'
import { Notifier } from '../../notifier/index.js'
import { getApplicationActorOfHost } from '@server/helpers/activity-pub-utils.js'

async function processActivityPubFollow (job: Job) {
  const payload = job.data as ActivitypubFollowPayload
  const host = payload.host

  const handle = host
    ? `${payload.name}@${host}`
    : payload.name

  logger.info('Processing ActivityPub follow in job %s.', job.id)

  let targetActor: MActorFull
  if (!host || host === WEBSERVER.HOST) {
    if (!payload.name) throw new Error('Payload name is mandatory for local follow')

    targetActor = await ActorModel.loadLocalByName(payload.name)
  } else {
    const sanitizedHost = sanitizeHost(host, REMOTE_SCHEME.HTTP)

    let actorUrl: string

    try {
      if (!payload.name) actorUrl = await getApplicationActorOfHost(sanitizedHost)
      if (!actorUrl) actorUrl = await loadActorUrlOrGetFromWebfinger((payload.name || SERVER_ACTOR_NAME) + '@' + sanitizedHost)

      targetActor = await getOrCreateAPActor(actorUrl, 'all')
    } catch (err) {
      logger.warn(`Do not follow ${handle} because we could not find the actor URL (in database or using webfinger)`, { err })
      return
    }
  }

  if (!targetActor) {
    logger.warn(`Do not follow ${handle} because we could not fetch/load the actor`)
    return
  }

  if (payload.assertIsChannel && !targetActor.VideoChannel) {
    logger.warn(`Do not follow ${handle} because it is not a channel.`)
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
    const [ actorFollow ] = await ActorFollowModel.findOrCreateCustom({
      byActor: fromActor,
      state,
      targetActor,
      activityId: getLocalActorFollowActivityPubUrl(fromActor, targetActor),
      transaction: t
    })

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
