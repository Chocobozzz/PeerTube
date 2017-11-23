import { Activity, ActivityType } from '../../../../shared/models/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { AccountInstance } from '../../../models/account/account-interface'
import { processAcceptActivity } from './process-accept'
import { processAddActivity } from './process-add'
import { processAnnounceActivity } from './process-announce'
import { processCreateActivity } from './process-create'
import { processDeleteActivity } from './process-delete'
import { processFollowActivity } from './process-follow'
import { processLikeActivity } from './process-like'
import { processUndoActivity } from './process-undo'
import { processUpdateActivity } from './process-update'

const processActivity: { [ P in ActivityType ]: (activity: Activity, inboxAccount?: AccountInstance) => Promise<any> } = {
  Create: processCreateActivity,
  Add: processAddActivity,
  Update: processUpdateActivity,
  Delete: processDeleteActivity,
  Follow: processFollowActivity,
  Accept: processAcceptActivity,
  Announce: processAnnounceActivity,
  Undo: processUndoActivity,
  Like: processLikeActivity
}

async function processActivities (activities: Activity[], inboxAccount?: AccountInstance) {
  for (const activity of activities) {
    const activityProcessor = processActivity[activity.type]
    if (activityProcessor === undefined) {
      logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id })
      continue
    }

    await activityProcessor(activity, inboxAccount)
  }
}

export {
  processActivities
}
