import * as express from 'express'
import { JobQueue } from '../../lib/job-queue'
import { asyncMiddleware } from '../../middlewares'
import { actorNameWithHostGetValidator } from '../../middlewares/validators'

const actorRouter = express.Router()

actorRouter.get('/:actorName',
  asyncMiddleware(actorNameWithHostGetValidator),
  getActor
)

// ---------------------------------------------------------------------------

export {
  actorRouter
}

// ---------------------------------------------------------------------------

function getActor (req: express.Request, res: express.Response) {
  let accountOrVideoChannel

  if (res.locals.account) {
    accountOrVideoChannel = res.locals.account
  }

  if (res.locals.videoChannel) {
    accountOrVideoChannel = res.locals.videoChannel
  }

  if (accountOrVideoChannel.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'actor', url: accountOrVideoChannel.Actor.url } })
  }

  return res.json(accountOrVideoChannel.toFormattedJSON())
}
