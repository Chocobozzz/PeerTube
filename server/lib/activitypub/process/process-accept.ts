import { ActivityAccept } from '../../../../shared/models/activitypub'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { addFetchOutboxJob } from '../actor'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorDefault, MActorSignature } from '../../../types/models'

async function processAcceptActivity (options: APProcessorOptions<ActivityAccept>) {
  const { byActor: targetActor, inboxActor } = options
  if (inboxActor === undefined) throw new Error('Need to accept on explicit inbox.')

  return processAccept(inboxActor, targetActor)
}

// ---------------------------------------------------------------------------

export {
  processAcceptActivity
}

// ---------------------------------------------------------------------------

async function processAccept (actor: MActorDefault, targetActor: MActorSignature) {
  const follow = await ActorFollowModel.loadByActorAndTarget(actor.id, targetActor.id)
  if (!follow) throw new Error('Cannot find associated follow.')

  if (follow.state !== 'accepted') {
    follow.state = 'accepted'
    await follow.save()

    await addFetchOutboxJob(targetActor)
  }
}
