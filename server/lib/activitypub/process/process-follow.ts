import { ActivityFollow } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { sendAccept, sendReject } from '../send'
import { Notifier } from '../../notifier'
import { getAPId } from '../../../helpers/activitypub'
import { getServerActor } from '../../../helpers/utils'
import { CONFIG } from '../../../initializers/config'
import { APProcessorOptions } from '../../../typings/activitypub-processor.model'
import { SignatureActorModel } from '../../../typings/models'
import { ActorFollowModelLight } from '../../../typings/models/actor-follow'

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

async function processFollow (byActor: SignatureActorModel, targetActorURL: string) {
  const { actorFollow, created, isFollowingInstance } = await sequelizeTypescript.transaction(async t => {
    const targetActor = await ActorModel.loadByUrlAndPopulateAccountAndChannel(targetActorURL, t)

    if (!targetActor) throw new Error('Unknown actor')
    if (targetActor.isOwned() === false) throw new Error('This is not a local actor.')

    const serverActor = await getServerActor()
    const isFollowingInstance = targetActor.id === serverActor.id

    if (isFollowingInstance && CONFIG.FOLLOWERS.INSTANCE.ENABLED === false) {
      logger.info('Rejecting %s because instance followers are disabled.', targetActor.url)

      await sendReject(byActor, targetActor)

      return { actorFollow: undefined }
    }

    const [ actorFollow, created ] = await ActorFollowModel.findOrCreate({
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
    }) as [ ActorFollowModelLight, boolean ]

    if (actorFollow.state !== 'accepted' && CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL === false) {
      actorFollow.state = 'accepted'
      await actorFollow.save({ transaction: t })
    }

    actorFollow.ActorFollower = byActor
    actorFollow.ActorFollowing = targetActor

    // Target sends to actor he accepted the follow request
    if (actorFollow.state === 'accepted') await sendAccept(actorFollow)

    return { actorFollow, created, isFollowingInstance }
  })

  // Rejected
  if (!actorFollow) return

  if (created) {
    if (isFollowingInstance) Notifier.Instance.notifyOfNewInstanceFollow(actorFollow)
    else Notifier.Instance.notifyOfNewUserFollow(actorFollow)
  }

  logger.info('Actor %s is followed by actor %s.', targetActorURL, byActor.url)
}
