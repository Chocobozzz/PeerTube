import { ActivityReject } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { runTransaction } from '../../../helpers/database-utils.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActor } from '../../../types/models/index.js'
import { getAPId } from '../activity.js'
import { buildAPFollowLockKey, runWithAPObjectLock } from '../ap-object-lock.js'
import { isActivityObjectTheFollow } from '../follow.js'
import { getLocalActorFollowActivityPubUrl } from '../url.js'

const logger = createLogger()

async function processRejectActivity (options: APProcessorOptions<ActivityReject>) {
  const { activity, byActor: targetActor, inboxActor } = options
  if (inboxActor === undefined) throw new Error('Need to reject on explicit inbox.')

  return runWithAPObjectLock(buildAPFollowLockKey(inboxActor.url, targetActor.url), () => processReject(activity, inboxActor, targetActor))
}

// ---------------------------------------------------------------------------

export {
  processRejectActivity
}

// ---------------------------------------------------------------------------

async function processReject (activity: ActivityReject, follower: MActor, targetActor: MActor) {
  return runTransaction(async t => {
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, targetActor.id, t)
    const followUrl = actorFollow?.url ?? getLocalActorFollowActivityPubUrl(follower, targetActor)

    if (!isActivityObjectTheFollow({ object: activity.object, followUrl, follower, following: targetActor })) {
      logger.debug('Ignoring reject %s of %s that does not answer the follow %s.', activity.id, getAPId(activity.object), followUrl)
      return undefined
    }

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${targetActor.id}.`)

    actorFollow.state = 'rejected'
    await actorFollow.save({ transaction: t })

    return undefined
  })
}
