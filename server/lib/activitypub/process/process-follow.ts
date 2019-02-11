import { ActivityFollow } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { sendAccept } from '../send'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'

async function processFollowActivity (activity: ActivityFollow, byActor: ActorModel) {
  const activityObject = getAPId(activity.object)

  return retryTransactionWrapper(processFollow, byActor, activityObject)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

async function processFollow (actor: ActorModel, targetActorURL: string) {
  const { actorFollow, created } = await sequelizeTypescript.transaction(async t => {
    const targetActor = await ActorModel.loadByUrlAndPopulateAccountAndChannel(targetActorURL, t)

    if (!targetActor) throw new Error('Unknown actor')
    if (targetActor.isOwned() === false) throw new Error('This is not a local actor.')

    const [ actorFollow, created ] = await ActorFollowModel.findOrCreate({
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
    await sendAccept(actorFollow)

    return { actorFollow, created }
  })

  if (created) Notifier.Instance.notifyOfNewFollow(actorFollow)

  logger.info('Actor %s is followed by actor %s.', targetActorURL, actor.url)
}
