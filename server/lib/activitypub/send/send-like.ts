import { Transaction } from 'sequelize'
import { ActivityLike } from '../../../../shared/models/activitypub/activity'
import { getServerAccount } from '../../../helpers/utils'
import { AccountInstance, VideoInstance } from '../../../models'
import { getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsToForwardVideoAction,
  getAudience,
  getOriginVideoAudience,
  getVideoFollowersAudience,
  unicastTo
} from './misc'

async function sendLikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const audience = getOriginVideoAudience(video)
  const data = await likeActivityData(url, byAccount, video, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendLikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoLikeActivityPubUrl(byAccount, video)

  const audience = getVideoFollowersAudience(video)
  const data = await likeActivityData(url, byAccount, video, audience)

  const accountsToForwardView = await getAccountsToForwardVideoAction(byAccount, video)
  const serverAccount = await getServerAccount()

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, serverAccount, accountsToForwardView, t, followersException)
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
