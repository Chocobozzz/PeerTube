import { ActivityReject } from '../../../../shared/models/activitypub/activity'
import { sequelizeTypescript } from '../../../initializers/database'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActor } from '../../../types/models'

async function processRejectActivity (options: APProcessorOptions<ActivityReject>) {
  const { byActor: targetActor, inboxActor } = options
  if (inboxActor === undefined) throw new Error('Need to reject on explicit inbox.')

  return processReject(inboxActor, targetActor)
}

// ---------------------------------------------------------------------------

export {
  processRejectActivity
}

// ---------------------------------------------------------------------------

async function processReject (follower: MActor, targetActor: MActor) {
  return sequelizeTypescript.transaction(async t => {
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, targetActor.id, t)

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${targetActor.id}.`)

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}
