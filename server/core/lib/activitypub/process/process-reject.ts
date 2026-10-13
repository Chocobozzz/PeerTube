import { ActivityReject } from '@peertube/peertube-models'
import { runTransaction } from '../../../helpers/database-utils.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActor } from '../../../types/models/index.js'
import { buildAPFollowLockKey, runWithAPObjectLock } from '../ap-object-lock.js'

async function processRejectActivity (options: APProcessorOptions<ActivityReject>) {
  const { byActor: targetActor, inboxActor } = options
  if (inboxActor === undefined) throw new Error('Need to reject on explicit inbox.')

  return runWithAPObjectLock(buildAPFollowLockKey(inboxActor.url, targetActor.url), () => processReject(inboxActor, targetActor))
}

// ---------------------------------------------------------------------------

export {
  processRejectActivity
}

// ---------------------------------------------------------------------------

async function processReject (follower: MActor, targetActor: MActor) {
  return runTransaction(async t => {
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, targetActor.id, t)

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${targetActor.id}.`)

    actorFollow.state = 'rejected'
    await actorFollow.save({ transaction: t })

    return undefined
  })
}
