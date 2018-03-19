import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { processAcceptActivity } from './process-accept'
import { processAnnounceActivity } from './process-announce'
import { processCreateActivity } from './process-create'
import { processDeleteActivity } from './process-delete'
import { processFollowActivity } from './process-follow'
import { processLikeActivity } from './process-like'
import { processRejectActivity } from './process-reject'
import { processUndoActivity } from './process-undo'
import { processUpdateActivity } from './process-update'

const processActivity: { [ P in ActivityType ]: (activity: Activity, inboxActor?: ActorModel) => Promise<any> } = {
  Create: processCreateActivity,
  Update: processUpdateActivity,
  Delete: processDeleteActivity,
  Follow: processFollowActivity,
  Accept: processAcceptActivity,
  Reject: processRejectActivity,
  Announce: processAnnounceActivity,
  Undo: processUndoActivity,
  Like: processLikeActivity
}

async function processActivities (activities: Activity[], signatureActor?: ActorModel, inboxActor?: ActorModel) {
  for (const activity of activities) {
    // When we fetch remote data, we don't have signature
    if (signatureActor && activity.actor !== signatureActor.url) {
      logger.warn('Signature mismatch between %s and %s.', activity.actor, signatureActor.url)
      continue
    }

    const activityProcessor = processActivity[activity.type]
    if (activityProcessor === undefined) {
      logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id })
      continue
    }

    try {
      await activityProcessor(activity, inboxActor)
    } catch (err) {
      logger.warn(err.stack)
      logger.warn('Cannot process activity %s.', activity.type, err)
    }
  }
}

export {
  processActivities
}
