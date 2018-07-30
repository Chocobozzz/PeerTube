import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { getVideoLikeActivityPubUrl } from '../url'
import { broadcastToFollowers, unicastTo } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience, getObjectFollowersAudience, getVideoAudience } from '../audience'
import { logger } from '../../../helpers/logger'

async function sendLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to like %s.', video.url)

  const url = getVideoLikeActivityPubUrl(byActor, video)

  const accountsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getVideoAudience(video, accountsInvolvedInVideo)
    const data = likeActivityData(url, byActor, video, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  // Send to followers
  const audience = getObjectFollowersAudience(accountsInvolvedInVideo)
  const data = likeActivityData(url, byActor, video, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, accountsInvolvedInVideo, t, followersException)
}

function likeActivityData (url: string, byActor: ActorModel, video: VideoModel, audience?: ActivityAudience): ActivityLike {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Like' as 'Like',
      id: url,
      actor: byActor.url,
      object: video.url
    },
    audience
  )
}

// ---------------------------------------------------------------------------

export {
  sendLike,
  likeActivityData
}
