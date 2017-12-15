import { ActivityFollow } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { sendAccept } from '../send'

async function processFollowActivity (activity: ActivityFollow) {
  const activityObject = activity.object
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  return processFollow(actor, activityObject)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

function processFollow (actor: ActorModel, targetActorURL: string) {
  const options = {
    arguments: [ actor, targetActorURL ],
    errorMessage: 'Cannot follow with many retries.'
  }

  return retryTransactionWrapper(follow, options)
}

async function follow (actor: ActorModel, targetActorURL: string) {
  await sequelizeTypescript.transaction(async t => {
    const targetActor = await ActorModel.loadByUrl(targetActorURL, t)

    if (!targetActor) throw new Error('Unknown actor')
    if (targetActor.isOwned() === false) throw new Error('This is not a local actor.')

    const [ actorFollow ] = await ActorFollowModel.findOrCreate({
      where: {
        actorId: actor.id,
        targetActorId: targetActor.id
      },
      defaults: {
        actorId: actor.id,
        targetActorId: targetActor.id,
        state: 'accepted'
      },
      transaction: t
    })

    if (actorFollow.state !== 'accepted') {
      actorFollow.state = 'accepted'
      await actorFollow.save({ transaction: t })
    }

    actorFollow.ActorFollower = actor
    actorFollow.ActorFollowing = targetActor

    // Target sends to actor he accepted the follow request
    return sendAccept(actorFollow, t)
  })

  logger.info('Actor %s is followed by actor %s.', actor.url, targetActorURL)
}
