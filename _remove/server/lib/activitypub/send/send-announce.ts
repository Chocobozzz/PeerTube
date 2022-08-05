import { Transaction } from 'sequelize'
import { ActivityAnnounce, ActivityAudience } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { MActorLight, MVideo } from '../../../types/models'
import { MVideoShare } from '../../../types/models/video'
import { audiencify, getAudience } from '../audience'
import { getActorsInvolvedInVideo, getAudienceFromFollowersOf } from './shared'
import { broadcastToFollowers } from './shared/send-utils'

async function buildAnnounceWithVideoAudience (
  byActor: MActorLight,
  videoShare: MVideoShare,
  video: MVideo,
  t: Transaction
) {
  const announcedObject = video.url

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getAudienceFromFollowersOf(actorsInvolvedInVideo)

  const activity = buildAnnounceActivity(videoShare.url, byActor, announcedObject, audience)

  return { activity, actorsInvolvedInVideo }
}

async function sendVideoAnnounce (byActor: MActorLight, videoShare: MVideoShare, video: MVideo, transaction: Transaction) {
  const { activity, actorsInvolvedInVideo } = await buildAnnounceWithVideoAudience(byActor, videoShare, video, transaction)

  logger.info('Creating job to send announce %s.', videoShare.url)

  return broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf: actorsInvolvedInVideo,
    transaction,
    actorsException: [ byActor ],
    contextType: 'Announce'
  })
}

function buildAnnounceActivity (url: string, byActor: MActorLight, object: string, audience?: ActivityAudience): ActivityAnnounce {
  if (!audience) audience = getAudience(byActor)

  return audiencify({
    type: 'Announce' as 'Announce',
    id: url,
    actor: byActor.url,
    object
  }, audience)
}

// ---------------------------------------------------------------------------

export {
  sendVideoAnnounce,
  buildAnnounceActivity,
  buildAnnounceWithVideoAudience
}
