import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, ActivityType, RootActivity } from '../../../shared'
import { logger } from '../../helpers'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { processCreateActivity, processUpdateActivity, processUndoActivity } from '../../lib'
import { processAcceptActivity } from '../../lib/activitypub/process/process-accept'
import { processAddActivity } from '../../lib/activitypub/process/process-add'
import { processAnnounceActivity } from '../../lib/activitypub/process/process-announce'
import { processDeleteActivity } from '../../lib/activitypub/process/process-delete'
import { processFollowActivity } from '../../lib/activitypub/process/process-follow'
import { asyncMiddleware, checkSignature, localAccountValidator, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'
import { AccountInstance } from '../../models/account/account-interface'

const processActivity: { [ P in ActivityType ]: (activity: Activity, inboxAccount?: AccountInstance) => Promise<any> } = {
  Create: processCreateActivity,
  Add: processAddActivity,
  Update: processUpdateActivity,
  Delete: processDeleteActivity,
  Follow: processFollowActivity,
  Accept: processAcceptActivity,
  Announce: processAnnounceActivity,
  Undo: processUndoActivity
}

const inboxRouter = express.Router()

inboxRouter.post('/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  activityPubValidator,
  asyncMiddleware(inboxController)
)

inboxRouter.post('/account/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  localAccountValidator,
  activityPubValidator,
  asyncMiddleware(inboxController)
)

// ---------------------------------------------------------------------------

export {
  inboxRouter
}

// ---------------------------------------------------------------------------

async function inboxController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const rootActivity: RootActivity = req.body
  let activities: Activity[] = []

  if ([ 'Collection', 'CollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubCollection).items
  } else if ([ 'OrderedCollection', 'OrderedCollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubOrderedCollection).orderedItems
  } else {
    activities = [ rootActivity as Activity ]
  }

  // Only keep activities we are able to process
  logger.debug('Filtering activities...', { activities })
  activities = activities.filter(a => isActivityValid(a))
  logger.debug('We keep %d activities.', activities.length, { activities })

  await processActivities(activities, res.locals.account)

  res.status(204).end()
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
