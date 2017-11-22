import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { database as db } from '../../initializers'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { addActivityData } from '../../lib/activitypub/send/send-add'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub/url'
import { announceActivityData } from '../../lib/index'
import { asyncMiddleware, localAccountValidator } from '../../middlewares'
import { AccountInstance } from '../../models/account/account-interface'

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
  const account: AccountInstance = res.locals.account

  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const data = await db.Video.listAllAndSharedByAccountForOutbox(account.id, start, count)
  const activities: Activity[] = []

  for (const video of data.data) {
    const videoObject = video.toActivityPubObject()

    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const addActivity = await addActivityData(video.url, video.VideoChannel.Account, video, video.VideoChannel.url, videoObject)

      const url = getAnnounceActivityPubUrl(video.url, account)
      const announceActivity = await announceActivityData(url, account, addActivity)

      activities.push(announceActivity)
    } else {
      const addActivity = await addActivityData(video.url, account, video, video.VideoChannel.url, videoObject)

      activities.push(addActivity)
    }
  }

  const newResult = {
    data: activities,
    total: data.total
  }
  const json = activityPubCollectionPagination(account.url + '/outbox', page, newResult)

  return res.json(json).end()
}
