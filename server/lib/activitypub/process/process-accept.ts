import { ActivityAccept } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { addFetchOutboxJob } from '../actor'

async function processAcceptActivity (activity: ActivityAccept, targetActor: ActorModel, inboxActor?: ActorModel) {
  if (inboxActor === undefined) throw new Error('Need to accept on explicit inbox.')

  return processAccept(inboxActor, targetActor)
}

// ---------------------------------------------------------------------------

export {
  processAcceptActivity
}

// ---------------------------------------------------------------------------

async function processAccept (actor: ActorModel, targetActor: ActorModel) {
  const follow = await ActorFollowModel.loadByActorAndTarget(actor.id, targetActor.id)
  if (!follow) throw new Error('Cannot find associated follow.')

  if (follow.state !== 'accepted') {
    follow.set('state', 'accepted')
    await follow.save()
    await addFetchOutboxJob(targetActor)
  }
}
