import { ActivityAccept } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { addFetchOutboxJob } from '../actor'
import { APProcessorOptions } from '../../../typings/activitypub-processor.model'
import { SignatureActorModel } from '../../../typings/models'

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

async function processAccept (actor: ActorModel, targetActor: SignatureActorModel) {
  const follow = await ActorFollowModel.loadByActorAndTarget(actor.id, targetActor.id)
  if (!follow) throw new Error('Cannot find associated follow.')

  if (follow.state !== 'accepted') {
    follow.set('state', 'accepted')
    await follow.save()

    await addFetchOutboxJob(targetActor)
  }
}
