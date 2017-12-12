import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityLike } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAudience,
  getOriginVideoAudience,
  getObjectFollowersAudience,
  unicastTo
} from './misc'

async function sendLikeToOrigin (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendLikeToVideoFollowers (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsInvolvedInVideo)
  const data = await likeActivityData(url, byAccount, video, t, audience)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, accountsInvolvedInVideo, t, followersException)
}

async function likeActivityData (
  url: string,
  byAccount: AccountModel,
  video: VideoModel,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityLike> {
  if (!audience) {
    audience = await getAudience(byAccount, t)
  }

  return {
    type: 'Like',
    id: url,
    actor: byAccount.url,
    to: audience.to,
    cc: audience.cc,
    object: video.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendLikeToOrigin,
  sendLikeToVideoFollowers,
  likeActivityData
}
