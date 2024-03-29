import { Activity, ActivityType } from '@peertube/peertube-models'
import { StatsManager } from '@server/lib/stat-manager.js'
import { logger } from '../../../helpers/logger.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorDefault, MActorSignature } from '../../../types/models/index.js'
import { getAPId } from '../activity.js'
import { getOrCreateAPActor } from '../actors/index.js'
import { checkUrlsSameHost } from '../url.js'
import { processAcceptActivity } from './process-accept.js'
import { processAnnounceActivity } from './process-announce.js'
import { processCreateActivity } from './process-create.js'
import { processDeleteActivity } from './process-delete.js'
import { processDislikeActivity } from './process-dislike.js'
import { processFlagActivity } from './process-flag.js'
import { processFollowActivity } from './process-follow.js'
import { processLikeActivity } from './process-like.js'
import { processRejectActivity } from './process-reject.js'
import { processReplyApprovalFactory } from './process-reply-approval.js'
import { processUndoActivity } from './process-undo.js'
import { processUpdateActivity } from './process-update.js'
import { processViewActivity } from './process-view.js'

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
  View: processViewActivity,
  ApproveReply: processReplyApprovalFactory('ApproveReply'),
  RejectReply: processReplyApprovalFactory('RejectReply')
}

export async function processActivities (
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

    const byActor = signatureActor || actorsCache[actorUrl] || await getOrCreateAPActor(actorUrl)
    actorsCache[actorUrl] = byActor

    const activityProcessor = processActivity[activity.type]
    if (activityProcessor === undefined) {
      logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id })
      continue
    }

    try {
      await activityProcessor({ activity, byActor, inboxActor, fromFetch })

      StatsManager.Instance.addInboxProcessedSuccess(activity.type)
    } catch (err) {
      logger.warn('Cannot process activity %s.', activity.type, { err })

      StatsManager.Instance.addInboxProcessedError(activity.type)
    }
  }
}
