import * as express from 'express'

import {
  processCreateActivity,
  processUpdateActivity,
  processFlagActivity
} from '../../lib'
import {
  Activity,
  ActivityType,
  RootActivity,
  ActivityPubCollection,
  ActivityPubOrderedCollection
} from '../../../shared'
import {
  signatureValidator,
  checkSignature,
  asyncMiddleware
} from '../../middlewares'
import { logger } from '../../helpers'

const processActivity: { [ P in ActivityType ]: (activity: Activity) => Promise<any> } = {
  Create: processCreateActivity,
  Update: processUpdateActivity,
  Flag: processFlagActivity
}

const inboxRouter = express.Router()

inboxRouter.post('/',
  signatureValidator,
  asyncMiddleware(checkSignature),
  // inboxValidator,
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
