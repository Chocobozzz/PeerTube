import * as express from 'express'
import { Activity, ActivityAdd } from '../../../shared/models/activitypub/activity'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { database as db } from '../../initializers'
import { addActivityData } from '../../lib/activitypub/send/send-add'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub/url'
import { announceActivityData } from '../../lib/index'
import { asyncMiddleware, localAccountValidator } from '../../middlewares'
import { AccountInstance } from '../../models/account/account-interface'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB } from '../../initializers/constants'

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

  const page = req.params.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const data = await db.Video.listAllAndSharedByAccountForOutbox(account.id, start, count)
  const activities: Activity[] = []

  for (const video of data.data) {
    const videoObject = video.toActivityPubObject()
    let addActivity: ActivityAdd = await addActivityData(video.url, account, video, video.VideoChannel.url, videoObject)

    // This is a shared video
    if (video.VideoShare !== undefined) {
      const url = getAnnounceActivityPubUrl(video.url, account)
      const announceActivity = await announceActivityData(url, account, addActivity)
      activities.push(announceActivity)
    } else {
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
