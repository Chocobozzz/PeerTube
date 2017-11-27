import { Transaction } from 'sequelize'
import { ActivityAdd } from '../../../../shared/index'
import { ActivityAnnounce, ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoInstance } from '../../../models'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { getAnnounceActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAccountsInvolvedInVideoChannel,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  getOriginVideoChannelAudience,
  unicastTo
} from './misc'
import { addActivityData } from './send-add'
import { createActivityData } from './send-create'

async function buildVideoAnnounceToFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(video.url, byAccount)

  const videoChannel = video.VideoChannel
  const announcedActivity = await addActivityData(url, videoChannel.Account, video, videoChannel.url, video.toActivityPubObject())

  const accountsToForwardView = await getAccountsInvolvedInVideo(video)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  const data = await announceActivityData(url, byAccount, announcedActivity, audience)

  return data
}

async function sendVideoAnnounceToFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const data = await buildVideoAnnounceToFollowers(byAccount, video, t)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAnnounceToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(video.url, byAccount)

  const videoChannel = video.VideoChannel
  const announcedActivity = await addActivityData(url, videoChannel.Account, video, videoChannel.url, video.toActivityPubObject())

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const data = await createActivityData(url, byAccount, announcedActivity, audience)

  return unicastTo(data, byAccount, videoChannel.Account.sharedInboxUrl, t)
}

async function buildVideoChannelAnnounceToFollowers (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(videoChannel.url, byAccount)
  const announcedActivity = await createActivityData(url, videoChannel.Account, videoChannel.toActivityPubObject())

  const accountsToForwardView = await getAccountsInvolvedInVideoChannel(videoChannel)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  const data = await announceActivityData(url, byAccount, announcedActivity, audience)

  return data
}

async function sendVideoChannelAnnounceToFollowers (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Transaction) {
  const data = await buildVideoChannelAnnounceToFollowers(byAccount, videoChannel, t)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoChannelAnnounceToOrigin (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(videoChannel.url, byAccount)
  const announcedActivity = await createActivityData(url, videoChannel.Account, videoChannel.toActivityPubObject())

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideoChannel(videoChannel)
  const audience = getOriginVideoChannelAudience(videoChannel, accountsInvolvedInVideo)
  const data = await createActivityData(url, byAccount, announcedActivity, audience)

  return unicastTo(data, byAccount, videoChannel.Account.sharedInboxUrl, t)
}

async function announceActivityData (
  url: string,
  byAccount: AccountInstance,
  object: ActivityCreate | ActivityAdd,
  audience?: ActivityAudience
) {
  if (!audience) {
    audience = await getAudience(byAccount)
  }

  const activity: ActivityAnnounce = {
    type: 'Announce',
    to: audience.to,
    cc: audience.cc,
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}

// ---------------------------------------------------------------------------

export {
  sendVideoAnnounceToFollowers,
  sendVideoChannelAnnounceToFollowers,
  sendVideoAnnounceToOrigin,
  sendVideoChannelAnnounceToOrigin,
  announceActivityData,
  buildVideoAnnounceToFollowers,
  buildVideoChannelAnnounceToFollowers
}
