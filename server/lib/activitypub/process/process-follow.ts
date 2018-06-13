import { ActivityFollow } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { sendAccept } from '../send'

async function processFollowActivity (activity: ActivityFollow) {
  const activityObject = activity.object
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  return retryTransactionWrapper(processFollow, actor, activityObject)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

async function processFollow (actor: ActorModel, targetActorURL: string) {
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

    actorFollow.ActorFollower = actor
    actorFollow.ActorFollowing = targetActor

    if (actorFollow.state !== 'accepted') {
      actorFollow.state = 'accepted'
      await actorFollow.save({ transaction: t })
    }

    actorFollow.ActorFollower = actor
    actorFollow.ActorFollowing = targetActor

    // Target sends to actor he accepted the follow request
    return sendAccept(actorFollow)
  })

  logger.info('Actor %s is followed by actor %s.', targetActorURL, actor.url)
}
