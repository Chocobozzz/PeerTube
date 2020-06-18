import { Activity, ActivityType } from '../../../../shared/models/activitypub'
import { checkUrlsSameHost, getAPId } from '../../../helpers/activitypub'
import { logger } from '../../../helpers/logger'
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
import { processDislikeActivity } from './process-dislike'
import { processFlagActivity } from './process-flag'
import { processViewActivity } from './process-view'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorDefault, MActorSignature } from '../../../types/models'

const processActivity: { [ P in ActivityType ]: (options: APProcessorOptions<Activity>) => Promise<any> } = {
  Create: processCreateActivity,
  Update: processUpdateActivity,
  Delete: processDeleteActivity,
  Follow: processFollowActivity,
  Accept: processAcceptActivity,
  Reject: processRejectActivity,
  Announce: processAnnounceActivity,
  Undo: processUndoActivity,
  Like: processLikeActivity,
  Dislike: processDislikeActivity,
  Flag: processFlagActivity,
  View: processViewActivity
}

async function processActivities (
  activities: Activity[],
  options: {
    signatureActor?: MActorSignature
    inboxActor?: MActorDefault
    outboxUrl?: string
    fromFetch?: boolean
  } = {}
) {
  const { outboxUrl, signatureActor, inboxActor, fromFetch = false } = options

  const actorsCache: { [ url: string ]: MActorSignature } = {}

  for (const activity of activities) {
    if (!signatureActor && [ 'Create', 'Announce', 'Like' ].includes(activity.type) === false) {
      logger.error('Cannot process activity %s (type: %s) without the actor signature.', activity.id, activity.type)
      continue
    }

    const actorUrl = getAPId(activity.actor)

    // When we fetch remote data, we don't have signature
    if (signatureActor && actorUrl !== signatureActor.url) {
      logger.warn('Signature mismatch between %s and %s, skipping.', actorUrl, signatureActor.url)
      continue
    }

    if (outboxUrl && checkUrlsSameHost(outboxUrl, actorUrl) !== true) {
      logger.warn('Host mismatch between outbox URL %s and actor URL %s, skipping.', outboxUrl, actorUrl)
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
      await activityProcessor({ activity, byActor, inboxActor, fromFetch })
    } catch (err) {
      logger.warn('Cannot process activity %s.', activity.type, { err })
    }
  }
}

export {
  processActivities
}
