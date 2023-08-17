import express from 'express'
import { Activity, VideoPrivacy } from '@peertube/peertube-models'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { activityPubCollectionPagination } from '@server/lib/activitypub/collection.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'
import { MActorLight } from '@server/types/models/index.js'
import { logger } from '../../helpers/logger.js'
import { buildAudience } from '../../lib/activitypub/audience.js'
import { buildAnnounceActivity, buildCreateActivity } from '../../lib/activitypub/send/index.js'
import {
  activityPubRateLimiter,
  asyncMiddleware,
  ensureIsLocalChannel,
  localAccountValidator,
  videoChannelsNameWithHostValidator
} from '../../middlewares/index.js'
import { apPaginationValidator } from '../../middlewares/validators/activitypub/index.js'
import { VideoModel } from '../../models/video/video.js'
import { activityPubResponse } from './utils.js'

const outboxRouter = express.Router()

outboxRouter.get('/accounts/:name/outbox',
  activityPubRateLimiter,
  apPaginationValidator,
  localAccountValidator,
  asyncMiddleware(outboxController)
)

outboxRouter.get('/video-channels/:nameWithHost/outbox',
  activityPubRateLimiter,
  apPaginationValidator,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
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

  return activityPubResponse(activityPubContextify(json, 'Collection', getContextFilter()), res)
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
      // FIXME: only use the video URL to reduce load. Breaks compat with PeerTube < 6.0.0
      const videoObject = await video.toActivityPubObject()
      const createActivity = buildCreateActivity(video.url, byActor, videoObject, createActivityAudience)

      activities.push(createActivity)
    }
  }

  return {
    data: activities,
    total: data.total
  }
}
