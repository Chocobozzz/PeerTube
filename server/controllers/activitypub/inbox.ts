import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, RootActivity } from '../../../shared'
import { logger } from '../../helpers'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { processActivities } from '../../lib/activitypub/process/process'
import { asyncMiddleware, checkSignature, localAccountValidator, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'

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
    activities = (rootActivity as ActivityPubOrderedCollection<Activity>).orderedItems
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
