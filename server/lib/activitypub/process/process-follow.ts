import { ActivityFollow } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { sendAccept, sendReject } from '../send'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'
import { CONFIG } from '../../../initializers/config'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorFollowActors, MActorSignature } from '../../../types/models'
import { autoFollowBackIfNeeded } from '../follow'
import { getServerActor } from '@server/models/application/application'

async function processFollowActivity (options: APProcessorOptions<ActivityFollow>) {
  const { activity, byActor } = options
  const activityObject = getAPId(activity.object)

  return retryTransactionWrapper(processFollow, byActor, activityObject)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

async function processFollow (byActor: MActorSignature, targetActorURL: string) {
  const { actorFollow, created, isFollowingInstance, targetActor } = await sequelizeTypescript.transaction(async t => {
    const targetActor = await ActorModel.loadByUrlAndPopulateAccountAndChannel(targetActorURL, t)

    if (!targetActor) throw new Error('Unknown actor')
    if (targetActor.isOwned() === false) throw new Error('This is not a local actor.')

    const serverActor = await getServerActor()
    const isFollowingInstance = targetActor.id === serverActor.id

    if (isFollowingInstance && CONFIG.FOLLOWERS.INSTANCE.ENABLED === false) {
      logger.info('Rejecting %s because instance followers are disabled.', targetActor.url)

      await sendReject(byActor, targetActor)

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
        state: CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL ? 'pending' : 'accepted'
      },
      transaction: t
    })

    // Set the follow as accepted if the remote actor follows a channel or account
    // Or if the instance automatically accepts followers
    if (actorFollow.state !== 'accepted' && (isFollowingInstance === false || CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL === false)) {
      actorFollow.state = 'accepted'
      await actorFollow.save({ transaction: t })
    }

    actorFollow.ActorFollower = byActor
    actorFollow.ActorFollowing = targetActor

    // Target sends to actor he accepted the follow request
    if (actorFollow.state === 'accepted') {
      await sendAccept(actorFollow)
      await autoFollowBackIfNeeded(actorFollow)
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
