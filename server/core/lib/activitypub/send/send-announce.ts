import { ActivityAnnounce, ActivityAudience } from '@peertube/peertube-models'
import { Transaction } from 'sequelize'
import { createLogger } from '../../../helpers/logger.js'
import { MActorLight, MVideo } from '../../../types/models/index.js'
import { MVideoShare } from '../../../types/models/video/index.js'
import { audiencify, getPublicAudience } from '../audience.js'
import { broadcastToFollowers, getActorsInvolvedInVideo } from './shared/send-utils.js'

const logger = createLogger()

export async function sendVideoAnnounce (options: {
  byActor: MActorLight
  videoShare: MVideoShare
  video: MVideo
  transaction: Transaction
}) {
  const { byActor, videoShare, video, transaction } = options

  const activity = buildAnnounceWithVideoAudience(byActor, videoShare, video)

  logger.info('Creating job to send announce %s.', videoShare.url)

  return broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf: await getActorsInvolvedInVideo(video, transaction),
    transaction,
    actorsException: [ byActor ],
    contextType: 'Announce'
  })
}

export function buildAnnounceWithVideoAudience (
  byActor: MActorLight,
  videoShare: MVideoShare,
  video: MVideo
) {
  const announcedObject = video.url

  const audience = getPublicAudience(byActor)

  const activity = buildAnnounceActivity(videoShare.url, byActor, announcedObject, audience)

  return activity
}

export function buildAnnounceActivity (url: string, byActor: MActorLight, object: string, audience?: ActivityAudience): ActivityAnnounce {
  if (!audience) audience = getPublicAudience(byActor)

  return audiencify({
    type: 'Announce',
    id: url,
    actor: byActor.url,
    object
  }, audience)
}
