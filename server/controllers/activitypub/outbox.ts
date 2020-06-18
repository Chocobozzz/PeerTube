import * as express from 'express'
import { Activity } from '../../../shared/models/activitypub/activity'
import { VideoPrivacy } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { logger } from '../../helpers/logger'
import { buildAnnounceActivity, buildCreateActivity } from '../../lib/activitypub/send'
import { buildAudience } from '../../lib/activitypub/audience'
import { asyncMiddleware, localAccountValidator, localVideoChannelValidator } from '../../middlewares'
import { VideoModel } from '../../models/video/video'
import { activityPubResponse } from './utils'
import { MActorLight } from '@server/types/models'
import { apPaginationValidator } from '../../middlewares/validators/activitypub'

const outboxRouter = express.Router()

outboxRouter.get('/accounts/:name/outbox',
  apPaginationValidator,
  localAccountValidator,
  asyncMiddleware(outboxController)
)

outboxRouter.get('/video-channels/:name/outbox',
  apPaginationValidator,
  localVideoChannelValidator,
  asyncMiddleware(outboxController)
)

// ---------------------------------------------------------------------------

export {
  outboxRouter
}

// ---------------------------------------------------------------------------

async function outboxController (req: express.Request, res: express.Response) {
  const accountOrVideoChannel = res.locals.account || res.locals.videoChannel
  const actor = accountOrVideoChannel.Actor
  const actorOutboxUrl = actor.url + '/outbox'

  logger.info('Receiving outbox request for %s.', actorOutboxUrl)

  const handler = (start: number, count: number) => buildActivities(actor, start, count)
  const json = await activityPubCollectionPagination(actorOutboxUrl, handler, req.query.page, req.query.size)

  return activityPubResponse(activityPubContextify(json), res)
}

async function buildActivities (actor: MActorLight, start: number, count: number) {
  const data = await VideoModel.listAllAndSharedByActorForOutbox(actor.id, start, count)
  const activities: Activity[] = []

  for (const video of data.data) {
    const byActor = video.VideoChannel.Account.Actor
    const createActivityAudience = buildAudience([ byActor.followersUrl ], video.privacy === VideoPrivacy.PUBLIC)

    // This is a shared video
    if (video.VideoShares !== undefined && video.VideoShares.length !== 0) {
      const videoShare = video.VideoShares[0]
      const announceActivity = buildAnnounceActivity(videoShare.url, actor, video.url, createActivityAudience)

      activities.push(announceActivity)
    } else {
      const videoObject = video.toActivityPubObject()
      const createActivity = buildCreateActivity(video.url, byActor, videoObject, createActivityAudience)

      activities.push(createActivity)
    }
  }

  return {
    data: activities,
    total: data.total
  }
}
