import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { getVideoLikeActivityPubUrl } from '../url'
import {
  audiencify,
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'

async function sendLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byActor, video)

  const accountsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
    const data = await likeActivityData(url, byActor, video, t, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  // Send to followers
  const audience = getObjectFollowersAudience(accountsInvolvedInVideo)
  const data = await likeActivityData(url, byActor, video, t, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, accountsInvolvedInVideo, t, followersException)
}

async function likeActivityData (
  url: string,
  byActor: ActorModel,
  video: VideoModel,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityLike> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

  return audiencify({
    type: 'Like' as 'Like',
    id: url,
    actor: byActor.url,
    object: video.url
  }, audience)
}

// ---------------------------------------------------------------------------

export {
  sendLike,
  likeActivityData
}
