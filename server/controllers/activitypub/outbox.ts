import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { VideoPrivacy } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { logger } from '../../helpers/logger'
import { announceActivityData, createActivityData } from '../../lib/activitypub/send'
import { buildAudience } from '../../lib/activitypub/audience'
import { asyncMiddleware, localAccountValidator } from '../../middlewares'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { VideoModel } from '../../models/video/video'
import { activityPubResponse } from './utils'

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
  const actorOutboxUrl = account.Actor.url + '/outbox'

  logger.info('Receiving outbox request for %s.', actorOutboxUrl)

  const handler = (start: number, count: number) => buildActivities(actor, start, count)
  const json = await activityPubCollectionPagination(actorOutboxUrl, handler, req.query.page)

  return activityPubResponse(activityPubContextify(json), res)
}

async function buildActivities (actor: ActorModel, start: number, count: number) {
  const data = await VideoModel.listAllAndSharedByActorForOutbox(actor.id, start, count)
  const activities: Activity[] = []

  // Avoid too many SQL requests
  const actors = data.data.map(v => v.VideoChannel.Account.Actor)
  actors.push(actor)

  const followersMatrix = await ActorModel.getActorsFollowerSharedInboxUrls(actors, undefined)

  for (const video of data.data) {
    const byActor = video.VideoChannel.Account.Actor
    const createActivityAudience = buildAudience(followersMatrix[byActor.id], video.privacy === VideoPrivacy.PUBLIC)

    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const videoShare = video.VideoShares[0]
      const announceAudience = buildAudience(followersMatrix[actor.id], video.privacy === VideoPrivacy.PUBLIC)
      const announceActivity = await announceActivityData(videoShare.url, actor, video.url, undefined, announceAudience)

      activities.push(announceActivity)
    } else {
      const videoObject = video.toActivityPubObject()
      const createActivity = await createActivityData(video.url, byActor, videoObject, undefined, createActivityAudience)

      activities.push(createActivity)
    }
  }

  return {
    data: activities,
    total: data.total
  }
}
