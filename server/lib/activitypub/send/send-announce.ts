import { Transaction } from 'sequelize'
import { ActivityAnnounce, ActivityAudience } from '../../../../shared/models/activitypub'
import { VideoModel } from '../../../models/video/video'
import { broadcastToFollowers } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience, getAudienceFromFollowersOf } from '../audience'
import { logger } from '../../../helpers/logger'
import { ActorModelOnly } from '../../../typings/models'
import { VideoShareModelOnly } from '../../../typings/models/video-share'

async function buildAnnounceWithVideoAudience (
  byActor: ActorModelOnly,
  videoShare: VideoShareModelOnly,
  video: VideoModel,
  t: Transaction
) {
  const announcedObject = video.url

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getAudienceFromFollowersOf(actorsInvolvedInVideo)

  const activity = buildAnnounceActivity(videoShare.url, byActor, announcedObject, audience)

  return { activity, actorsInvolvedInVideo }
}

async function sendVideoAnnounce (byActor: ActorModelOnly, videoShare: VideoShareModelOnly, video: VideoModel, t: Transaction) {
  const { activity, actorsInvolvedInVideo } = await buildAnnounceWithVideoAudience(byActor, videoShare, video, t)

  logger.info('Creating job to send announce %s.', videoShare.url)

  const followersException = [ byActor ]
  return broadcastToFollowers(activity, byActor, actorsInvolvedInVideo, t, followersException)
}

function buildAnnounceActivity (url: string, byActor: ActorModelOnly, object: string, audience?: ActivityAudience): ActivityAnnounce {
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
