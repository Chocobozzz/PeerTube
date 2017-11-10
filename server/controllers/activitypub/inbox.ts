import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, ActivityType, RootActivity } from '../../../shared'
import { logger } from '../../helpers'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { processCreateActivity, processFlagActivity, processUpdateActivity } from '../../lib'
import { processAddActivity } from '../../lib/activitypub/process-add'
import { asyncMiddleware, checkSignature, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'

const processActivity: { [ P in ActivityType ]: (activity: Activity) => Promise<any> } = {
  Create: processCreateActivity,
  Add: processAddActivity,
  Update: processUpdateActivity,
  Flag: processFlagActivity
}

const inboxRouter = express.Router()

inboxRouter.post('/',
  signatureValidator,
  asyncMiddleware(checkSignature),
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
  activities = activities.filter(a => isActivityValid(a))

  await processActivities(activities)

  res.status(204).end()
}

async function processActivities (activities: Activity[]) {
  for (const activity of activities) {
    const activityProcessor = processActivity[activity.type]
    if (activityProcessor === undefined) {
      logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id })
      continue
    }

    await activityProcessor(activity)
  }
}
