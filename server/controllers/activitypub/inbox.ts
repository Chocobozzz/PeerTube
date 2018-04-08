import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, RootActivity } from '../../../shared'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../helpers/logger'
import { processActivities } from '../../lib/activitypub/process/process'
import { asyncMiddleware, checkSignature, localAccountValidator, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'
import { ActorModel } from '../../models/activitypub/actor'

const inboxRouter = express.Router()

inboxRouter.post('/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(activityPubValidator),
  asyncMiddleware(inboxController)
)

inboxRouter.post('/accounts/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(activityPubValidator),
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

  console.log(rootActivity)

  if ([ 'Collection', 'CollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubCollection).items
  } else if ([ 'OrderedCollection', 'OrderedCollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubOrderedCollection<Activity>).orderedItems
  } else {
    activities = [ rootActivity as Activity ]
  }

  // Only keep activities we are able to process
  logger.debug('Filtering %d activities...', activities.length)
  activities = activities.filter(a => isActivityValid(a))
  logger.debug('We keep %d activities.', activities.length, { activities })

  let specificActor: ActorModel = undefined
  if (res.locals.account) {
    specificActor = res.locals.account
  } else if (res.locals.videoChannel) {
    specificActor = res.locals.videoChannel
  }

  logger.info('Receiving inbox requests for %d activities by %s.', activities.length, res.locals.signature.actor.url)

  await processActivities(activities, res.locals.signature.actor, specificActor)

  res.status(204).end()
}
