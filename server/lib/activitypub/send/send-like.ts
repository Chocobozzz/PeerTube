import { Transaction } from 'sequelize'
import { ActivityLike } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoInstance } from '../../../models'
import { getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAudience,
  getOriginVideoAudience,
  getVideoFollowersAudience,
  unicastTo
} from './misc'

async function sendLikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendLikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video)
  const audience = getVideoFollowersAudience(accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, audience)

  const toAccountsFollowers = await getAccountsInvolvedInVideo(video)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, toAccountsFollowers, t, followersException)
}

async function likeActivityData (url: string, byAccount: AccountInstance, video: VideoInstance, audience?: { to: string[], cc: string[] }) {
  if (!audience) {
    audience = await getAudience(byAccount)
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
