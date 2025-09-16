import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, HttpStatusCode, RootActivity } from '@peertube/peertube-models'
import { InboxManager } from '@server/lib/activitypub/inbox-manager.js'
import express from 'express'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity.js'
import { logger } from '../../helpers/logger.js'
import {
  accountHandleGetValidatorFactory,
  activityPubRateLimiter,
  asyncMiddleware,
  checkSignature,
  signatureValidator,
  videoChannelsHandleValidatorFactory
} from '../../middlewares/index.js'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity.js'

const inboxRouter = express.Router()

inboxRouter.post(
  '/inbox',
  activityPubRateLimiter,
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(activityPubValidator),
  inboxController
)

inboxRouter.post(
  '/accounts/:handle/inbox',
  activityPubRateLimiter,
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: true, checkCanManage: false })),
  asyncMiddleware(activityPubValidator),
  inboxController
)

inboxRouter.post(
  '/video-channels/:handle/inbox',
  activityPubRateLimiter,
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: false, checkIsOwner: false })),
  asyncMiddleware(activityPubValidator),
  inboxController
)

// ---------------------------------------------------------------------------

export {
  inboxRouter
}

// ---------------------------------------------------------------------------

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
  logger.debug('Filtering %d activities...', activities.length, { activities })
  activities = activities.filter(a => isActivityValid(a))
  logger.debug('We keep %d activities.', activities.length, { activities })

  const accountOrChannel = res.locals.account || res.locals.videoChannel

  logger.info('Receiving inbox requests for %d activities by %s.', activities.length, res.locals.signature.actor.url)

  InboxManager.Instance.addInboxMessage({
    activities,
    signatureActor: res.locals.signature.actor,
    inboxActor: accountOrChannel
      ? accountOrChannel.Actor
      : undefined
  })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
