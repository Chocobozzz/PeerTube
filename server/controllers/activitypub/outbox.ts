import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { addActivityData } from '../../lib/activitypub/send/send-add'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub/url'
import { announceActivityData } from '../../lib/index'
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

  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const data = await VideoModel.listAllAndSharedByAccountForOutbox(account.id, start, count)
  const activities: Activity[] = []

  for (const video of data.data) {
    const videoObject = video.toActivityPubObject()

    // This is a shared video
    const videoChannel = video.VideoChannel
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const addActivity = await addActivityData(video.url, videoChannel.Account, video, videoChannel.Actor.url, videoObject, undefined)

      const url = getAnnounceActivityPubUrl(video.url, account)
      const announceActivity = await announceActivityData(url, account, addActivity, undefined)

      activities.push(announceActivity)
    } else {
      const addActivity = await addActivityData(video.url, account, video, videoChannel.Actor.url, videoObject, undefined)

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
