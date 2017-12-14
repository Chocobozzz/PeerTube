import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { announceActivityData, createActivityData } from '../../lib/activitypub/send'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub/url'
import { asyncMiddleware, localAccountValidator } from '../../middlewares'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'

const outboxRouter = express.Router()

outboxRouter.get('/account/:name/outbox',
  localAccountValidator,
  asyncMiddleware(outboxController)
)

// ---------------------------------------------------------------------------

export {
  outboxRouter
}

// ---------------------------------------------------------------------------

async function outboxController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const actor = account.Actor

  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const data = await VideoModel.listAllAndSharedByActorForOutbox(actor.id, start, count)
  const activities: Activity[] = []

  for (const video of data.data) {
    const videoObject = video.toActivityPubObject()

    const videoChannel = video.VideoChannel
    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const createActivity = await createActivityData(video.url, videoChannel.Account.Actor, videoObject, undefined)

      const url = getAnnounceActivityPubUrl(video.url, actor)
      const announceActivity = await announceActivityData(url, actor, createActivity, undefined)

      activities.push(announceActivity)
    } else {
      const createActivity = await createActivityData(video.url, videoChannel.Account.Actor, videoObject, undefined)

      activities.push(createActivity)
    }
  }

  const newResult = {
    data: activities,
    total: data.total
  }
  const json = activityPubCollectionPagination(account.Actor.url + '/outbox', page, newResult)

  return res.json(json).end()
}
