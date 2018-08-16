import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { VideoPrivacy } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { logger } from '../../helpers/logger'
import { announceActivityData, createActivityData } from '../../lib/activitypub/send'
import { buildAudience } from '../../lib/activitypub/audience'
import { asyncMiddleware, localAccountValidator, localVideoChannelValidator } from '../../middlewares'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { VideoModel } from '../../models/video/video'
import { activityPubResponse } from './utils'
import { VideoChannelModel } from '../../models/video/video-channel'

const outboxRouter = express.Router()

outboxRouter.get('/accounts/:name/outbox',
  localAccountValidator,
  asyncMiddleware(outboxController)
)

outboxRouter.get('/video-channels/:name/outbox',
  localVideoChannelValidator,
  asyncMiddleware(outboxController)
)

// ---------------------------------------------------------------------------

export {
  outboxRouter
}

// ---------------------------------------------------------------------------

async function outboxController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const accountOrVideoChannel: AccountModel | VideoChannelModel = res.locals.account || res.locals.videoChannel
  const actor = accountOrVideoChannel.Actor
  const actorOutboxUrl = actor.url + '/outbox'

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

  for (const video of data.data) {
    const byActor = video.VideoChannel.Account.Actor
    const createActivityAudience = buildAudience([ byActor.followersUrl ], video.privacy === VideoPrivacy.PUBLIC)

    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const videoShare = video.VideoShares[0]
      const announceActivity = announceActivityData(videoShare.url, actor, video.url, createActivityAudience)

      activities.push(announceActivity)
    } else {
      const videoObject = video.toActivityPubObject()
      const createActivity = createActivityData(video.url, byActor, videoObject, createActivityAudience)

      activities.push(createActivity)
    }
  }

  return {
    data: activities,
    total: data.total
  }
}
