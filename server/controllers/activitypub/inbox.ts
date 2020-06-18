import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, RootActivity } from '../../../shared'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../helpers/logger'
import { processActivities } from '../../lib/activitypub/process/process'
import { asyncMiddleware, checkSignature, localAccountValidator, localVideoChannelValidator, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'
import { queue } from 'async'
import { MActorDefault, MActorSignature } from '../../types/models'

const inboxRouter = express.Router()

inboxRouter.post('/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(activityPubValidator),
  inboxController
)

inboxRouter.post('/accounts/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(activityPubValidator),
  inboxController
)
inboxRouter.post('/video-channels/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(localVideoChannelValidator),
  asyncMiddleware(activityPubValidator),
  inboxController
)

// ---------------------------------------------------------------------------

export {
  inboxRouter
}

// ---------------------------------------------------------------------------

type QueueParam = { activities: Activity[], signatureActor?: MActorSignature, inboxActor?: MActorDefault }
const inboxQueue = queue<QueueParam, Error>((task, cb) => {
  const options = { signatureActor: task.signatureActor, inboxActor: task.inboxActor }

  processActivities(task.activities, options)
    .then(() => cb())
    .catch(err => {
      logger.error('Error in process activities.', { err })
      cb()
    })
})

function inboxController (req: express.Request, res: express.Response) {
  const rootActivity: RootActivity = req.body
  let activities: Activity[]

  if ([ 'Collection', 'CollectionPage' ].includes(rootActivity.type)) {
    activities = (rootActivity as ActivityPubCollection).items
  } else if ([ 'OrderedCollection', 'OrderedCollectionPage' ].includes(rootActivity.type)) {
    activities = (rootActivity as ActivityPubOrderedCollection<Activity>).orderedItems
  } else {
    activities = [ rootActivity as Activity ]
  }

  // Only keep activities we are able to process
  logger.debug('Filtering %d activities...', activities.length)
  activities = activities.filter(a => isActivityValid(a))
  logger.debug('We keep %d activities.', activities.length, { activities })

  const accountOrChannel = res.locals.account || res.locals.videoChannel

  logger.info('Receiving inbox requests for %d activities by %s.', activities.length, res.locals.signature.actor.url)

  inboxQueue.push({
    activities,
    signatureActor: res.locals.signature.actor,
    inboxActor: accountOrChannel ? accountOrChannel.Actor : undefined
  })

  return res.status(204).end()
}
