import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { announceActivityData, createActivityData } from '../../lib/activitypub/send'
import { buildAudience } from '../../lib/activitypub/send/misc'
import { asyncMiddleware, localAccountValidator } from '../../middlewares'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { VideoModel } from '../../models/video/video'

const outboxRouter = express.Router()

outboxRouter.get('/accounts/:name/outbox',
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

  // Avoid too many SQL requests
  const actors = data.data.map(v => v.VideoChannel.Account.Actor)
  actors.push(actor)

  const followersMatrix = await ActorModel.getActorsFollowerSharedInboxUrls(actors, undefined)

  for (const video of data.data) {
    const byActor = video.VideoChannel.Account.Actor
    const createActivityAudience = buildAudience(followersMatrix[byActor.id])

    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const videoShare = video.VideoShares[0]
      const announceAudience = buildAudience(followersMatrix[actor.id])
      const announceActivity = await announceActivityData(videoShare.url, actor, video.url, undefined, announceAudience)

      activities.push(announceActivity)
    } else {
      const videoObject = video.toActivityPubObject()
      const createActivity = await createActivityData(video.url, byActor, videoObject, undefined, createActivityAudience)

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
