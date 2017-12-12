import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { getServerAccount } from '../../../helpers'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getVideoAbuseActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'

async function sendCreateVideoChannel (videoChannel: VideoChannelModel, t: Transaction) {
  const byAccount = videoChannel.Account

  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await createActivityData(videoChannel.url, byAccount, videoChannelObject, t)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAbuse (byAccount: AccountModel, videoAbuse: VideoAbuseModel, video: VideoModel, t: Transaction) {
  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  const audience = { to: [ video.VideoChannel.Account.url ], cc: [] }
  const data = await createActivityData(url, byAccount, videoAbuse.toActivityPubObject(), t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendCreateViewToOrigin (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byAccount, video)
  const viewActivity = createViewActivityData(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await createActivityData(url, byAccount, viewActivity, t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendCreateViewToVideoFollowers (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byAccount, video)
  const viewActivity = createViewActivityData(byAccount, video)

  const accountsToForwardView = await getAccountsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  const data = await createActivityData(url, byAccount, viewActivity, t, audience)

  // Use the server account to send the view, because it could be an unregistered account
  const serverAccount = await getServerAccount()
  const followersException = [ byAccount ]
  return broadcastToFollowers(data, serverAccount, accountsToForwardView, t, followersException)
}

async function sendCreateDislikeToOrigin (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byAccount, video)
  const dislikeActivity = createDislikeActivityData(byAccount, video)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await createActivityData(url, byAccount, dislikeActivity, t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendCreateDislikeToVideoFollowers (byAccount: AccountModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byAccount, video)
  const dislikeActivity = createDislikeActivityData(byAccount, video)

  const accountsToForwardView = await getAccountsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  const data = await createActivityData(url, byAccount, dislikeActivity, t, audience)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, accountsToForwardView, t, followersException)
}

async function createActivityData (
  url: string,
  byAccount: AccountModel,
  object: any,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityCreate> {
  if (!audience) {
    audience = await getAudience(byAccount, t)
  }

  return {
    type: 'Create',
    id: url,
    actor: byAccount.url,
    to: audience.to,
    cc: audience.cc,
    object
  }
}

function createDislikeActivityData (byAccount: AccountModel, video: VideoModel) {
  return {
    type: 'Dislike',
    actor: byAccount.url,
    object: video.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendCreateVideoChannel,
  sendVideoAbuse,
  createActivityData,
  sendCreateViewToOrigin,
  sendCreateViewToVideoFollowers,
  sendCreateDislikeToOrigin,
  sendCreateDislikeToVideoFollowers,
  createDislikeActivityData
}

// ---------------------------------------------------------------------------

function createViewActivityData (byAccount: AccountModel, video: VideoModel) {
  return {
    type: 'View',
    actor: byAccount.url,
    object: video.url
  }
}
