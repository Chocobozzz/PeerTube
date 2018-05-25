import { ActivityAccept } from '../../../../shared/models/activitypub'
import { getActorUrl } from '../../../helpers/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { addFetchOutboxJob } from '../actor'

async function processAcceptActivity (activity: ActivityAccept, inboxActor?: ActorModel) {
  if (inboxActor === undefined) throw new Error('Need to accept on explicit inbox.')

  const actorUrl = getActorUrl(activity.actor)
  const targetActor = await ActorModel.loadByUrl(actorUrl)

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
