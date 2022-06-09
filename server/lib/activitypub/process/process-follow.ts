import { getServerActor } from '@server/models/application/application'
import { ActivityFollow } from '../../../../shared/models/activitypub'
import { getAPId } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { ActorModel } from '../../../models/actor/actor'
import { ActorFollowModel } from '../../../models/actor/actor-follow'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorFollowActors, MActorSignature } from '../../../types/models'
import { Notifier } from '../../notifier'
import { autoFollowBackIfNeeded } from '../follow'
import { sendAccept, sendReject } from '../send'

async function processFollowActivity (options: APProcessorOptions<ActivityFollow>) {
  const { activity, byActor } = options

  const activityId = activity.id
  const objectId = getAPId(activity.object)

  return retryTransactionWrapper(processFollow, byActor, activityId, objectId)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

async function processFollow (byActor: MActorSignature, activityId: string, targetActorURL: string) {
  const { actorFollow, created, isFollowingInstance, targetActor } = await sequelizeTypescript.transaction(async t => {
    const targetActor = await ActorModel.loadByUrlAndPopulateAccountAndChannel(targetActorURL, t)

    if (!targetActor) throw new Error('Unknown actor')
    if (targetActor.isOwned() === false) throw new Error('This is not a local actor.')

    const serverActor = await getServerActor()
    const isFollowingInstance = targetActor.id === serverActor.id

    if (isFollowingInstance && CONFIG.FOLLOWERS.INSTANCE.ENABLED === false) {
      logger.info('Rejecting %s because instance followers are disabled.', targetActor.url)

      sendReject(activityId, byActor, targetActor)

      return { actorFollow: undefined as MActorFollowActors }
    }

    const [ actorFollow, created ] = await ActorFollowModel.findOrCreate<MActorFollowActors>({
      where: {
        actorId: byActor.id,
        targetActorId: targetActor.id
      },
      defaults: {
        actorId: byActor.id,
        targetActorId: targetActor.id,
        url: activityId,

        state: CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL
          ? 'pending'
          : 'accepted'
      },
      transaction: t
    })

    // Set the follow as accepted if the remote actor follows a channel or account
    // Or if the instance automatically accepts followers
    if (actorFollow.state !== 'accepted' && (isFollowingInstance === false || CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL === false)) {
      actorFollow.state = 'accepted'

      await actorFollow.save({ transaction: t })
    }

    // Before PeerTube V3 we did not save the follow ID. Try to fix these old follows
    if (!actorFollow.url) {
      actorFollow.url = activityId
      await actorFollow.save({ transaction: t })
    }

    actorFollow.ActorFollower = byActor
    actorFollow.ActorFollowing = targetActor

    // Target sends to actor he accepted the follow request
    if (actorFollow.state === 'accepted') {
      sendAccept(actorFollow)

      await autoFollowBackIfNeeded(actorFollow, t)
    }

    return { actorFollow, created, isFollowingInstance, targetActor }
  })

  // Rejected
  if (!actorFollow) return

  if (created) {
    const follower = await ActorModel.loadFull(byActor.id)
    const actorFollowFull = Object.assign(actorFollow, { ActorFollowing: targetActor, ActorFollower: follower })

    if (isFollowingInstance) {
      Notifier.Instance.notifyOfNewInstanceFollow(actorFollowFull)
    } else {
      Notifier.Instance.notifyOfNewUserFollow(actorFollowFull)
    }
  }

  logger.info('Actor %s is followed by actor %s.', targetActorURL, byActor.url)
}
