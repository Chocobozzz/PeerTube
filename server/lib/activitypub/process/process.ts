import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import { getActorUrl } from '../../../helpers/activitypub'
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
import { getOrCreateActorAndServerAndModel } from '../actor'

const processActivity: { [ P in ActivityType ]: (activity: Activity, byActor: ActorModel, inboxActor?: ActorModel) => Promise<any> } = {
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
  const actorsCache: { [ url: string ]: ActorModel } = {}

  for (const activity of activities) {
    if (!signatureActor && [ 'Create', 'Announce', 'Like' ].indexOf(activity.type) === -1) {
      logger.error('Cannot process activity %s (type: %s) without the actor signature.', activity.id, activity.type)
      continue
    }

    const actorUrl = getActorUrl(activity.actor)

    // When we fetch remote data, we don't have signature
    if (signatureActor && actorUrl !== signatureActor.url) {
      logger.warn('Signature mismatch between %s and %s.', actorUrl, signatureActor.url)
      continue
    }

    const byActor = signatureActor || actorsCache[actorUrl] || await getOrCreateActorAndServerAndModel(actorUrl)
    actorsCache[actorUrl] = byActor

    const activityProcessor = processActivity[activity.type]
    if (activityProcessor === undefined) {
      logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id })
      continue
    }

    try {
      await activityProcessor(activity, byActor, inboxActor)
    } catch (err) {
      logger.warn('Cannot process activity %s.', activity.type, { err })
    }
  }
}

export {
  processActivities
}
