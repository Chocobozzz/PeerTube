import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoInstance } from '../../../models'
import { getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAudience,
  getOriginVideoAudience,
  getObjectFollowersAudience,
  unicastTo
} from './misc'

async function sendLikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendLikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, t, audience)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, accountsInvolvedInVideo, t, followersException)
}

async function likeActivityData (
  url: string,
  byAccount: AccountInstance,
  video: VideoInstance,
  t: Transaction,
  audience?: ActivityAudience
) {
  if (!audience) {
    audience = await getAudience(byAccount, t)
  }

  const activity: ActivityLike = {
    type: 'Like',
    id: url,
    actor: byAccount.url,
    to: audience.to,
    cc: audience.cc,
    object: video.url
  }

  return activity
}

// ---------------------------------------------------------------------------

export {
  sendLikeToOrigin,
  sendLikeToVideoFollowers,
  likeActivityData
}
