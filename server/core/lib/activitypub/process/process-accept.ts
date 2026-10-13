import { ActivityAccept } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorDefault, MActorSignature } from '../../../types/models/index.js'
import { getAPId } from '../activity.js'
import { buildAPFollowLockKey, runWithAPObjectLock } from '../ap-object-lock.js'
import { addFetchOutboxJob } from '../outbox.js'
import { sendUndoFollow } from '../send/index.js'
import { getLocalActorFollowActivityPubUrl } from '../url.js'

const logger = createLogger()

async function processAcceptActivity (options: APProcessorOptions<ActivityAccept>) {
  const { activity, byActor: targetActor, inboxActor } = options
  if (inboxActor === undefined) throw new Error('Need to accept on explicit inbox.')

  return runWithAPObjectLock(buildAPFollowLockKey(inboxActor.url, targetActor.url), () => {
    return processAccept(activity, inboxActor, targetActor)
  })
}

// ---------------------------------------------------------------------------

export {
  processAcceptActivity
}

// ---------------------------------------------------------------------------

async function processAccept (activity: ActivityAccept, actor: MActorDefault, targetActor: MActorSignature) {
  const follow = await ActorFollowModel.loadByActorAndTarget(actor.id, targetActor.id)

  if (!follow) {
    const followUrl = getLocalActorFollowActivityPubUrl(actor, targetActor)

    // Not a follow we sent: nothing to undo
    if (getAPId(activity.object) !== followUrl) {
      logger.warn('Cannot find the follow of %s by %s accepted by %s.', targetActor.url, actor.url, getAPId(activity.object))
      return
    }

    // Re-send the undo, just in case the remote server did not process it correctly
    logger.info('Accepted follow of %s by %s does not exist anymore, sending an undo follow.', targetActor.url, actor.url)

    sendUndoFollow({ url: followUrl, ActorFollower: actor, ActorFollowing: targetActor }, undefined)
    return
  }

  if (follow.state !== 'accepted') {
    follow.state = 'accepted'
    await follow.save()

    await addFetchOutboxJob(targetActor)
  }
}
