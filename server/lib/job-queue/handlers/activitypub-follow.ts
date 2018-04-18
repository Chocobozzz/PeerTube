import * as kue from 'kue'
import { logger } from '../../../helpers/logger'
import { getServerActor } from '../../../helpers/utils'
import { REMOTE_SCHEME, sequelizeTypescript, SERVER_ACTOR_NAME } from '../../../initializers'
import { sendFollow } from '../../activitypub/send'
import { sanitizeHost } from '../../../helpers/core-utils'
import { loadActorUrlOrGetFromWebfinger } from '../../../helpers/webfinger'
import { getOrCreateActorAndServerAndModel } from '../../activitypub/actor'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { ActorModel } from '../../../models/activitypub/actor'

export type ActivitypubFollowPayload = {
  host: string
}

async function processActivityPubFollow (job: kue.Job) {
  const payload = job.data as ActivitypubFollowPayload
  const host = payload.host

  logger.info('Processing ActivityPub follow in job %d.', job.id)

  const sanitizedHost = sanitizeHost(host, REMOTE_SCHEME.HTTP)

  const actorUrl = await loadActorUrlOrGetFromWebfinger(SERVER_ACTOR_NAME, sanitizedHost)
  const targetActor = await getOrCreateActorAndServerAndModel(actorUrl)

  const fromActor = await getServerActor()
  const options = {
    arguments: [ fromActor, targetActor ],
    errorMessage: 'Cannot follow with many retries.'
  }

  return retryTransactionWrapper(follow, options)
}
// ---------------------------------------------------------------------------

export {
  processActivityPubFollow
}

// ---------------------------------------------------------------------------

function follow (fromActor: ActorModel, targetActor: ActorModel) {
  if (fromActor.id === targetActor.id) {
    throw new Error('Follower is the same than target actor.')
  }

  return sequelizeTypescript.transaction(async t => {
    const [ actorFollow ] = await ActorFollowModel.findOrCreate({
      where: {
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      defaults: {
        state: 'pending',
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      transaction: t
    })
    actorFollow.ActorFollowing = targetActor
    actorFollow.ActorFollower = fromActor

    // Send a notification to remote server
    await sendFollow(actorFollow)
  })
}
