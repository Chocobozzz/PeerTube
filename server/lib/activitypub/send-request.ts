import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers'
import {
  AccountInstance,
  VideoInstance,
  VideoChannelInstance
} from '../../models'
import { httpRequestJobScheduler } from '../jobs'
import { signObject, activityPubContextify } from '../../helpers'
import { Activity } from '../../../shared'
import { VideoAbuseInstance } from '../../models/video/video-abuse-interface'
import { getActivityPubUrl } from '../../helpers/activitypub'
import { logger } from '../../helpers/logger'

async function sendCreateVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await createActivityData(videoChannel.url, videoChannel.Account, videoChannelObject)

  return broadcastToFollowers(data, [ videoChannel.Account ], t)
}

async function sendUpdateVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await updateActivityData(videoChannel.url, videoChannel.Account, videoChannelObject)

  return broadcastToFollowers(data, [ videoChannel.Account ], t)
}

async function sendDeleteVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const data = await deleteActivityData(videoChannel.url, videoChannel.Account)

  return broadcastToFollowers(data, [ videoChannel.Account ], t)
}

async function sendAddVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const videoObject = video.toActivityPubObject()
  const data = await addActivityData(video.url, video.VideoChannel.Account, video.VideoChannel.url, videoObject)

  return broadcastToFollowers(data, [ video.VideoChannel.Account ], t)
}

async function sendUpdateVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const videoObject = video.toActivityPubObject()
  const data = await updateActivityData(video.url, video.VideoChannel.Account, videoObject)

  return broadcastToFollowers(data, [ video.VideoChannel.Account ], t)
}

async function sendDeleteVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const data = await deleteActivityData(video.url, video.VideoChannel.Account)

  return broadcastToFollowers(data, [ video.VideoChannel.Account ], t)
}

async function sendDeleteAccount (account: AccountInstance, t: Sequelize.Transaction) {
  const data = await deleteActivityData(account.url, account)

  return broadcastToFollowers(data, [ account ], t)
}

async function sendVideoChannelAnnounce (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const url = getActivityPubUrl('videoChannel', videoChannel.uuid) + '#announce'
  const announcedActivity = await createActivityData(url, videoChannel.Account, videoChannel.toActivityPubObject(), true)

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, [ byAccount ], t)
}

async function sendVideoAnnounce (byAccount: AccountInstance, video: VideoInstance, t: Sequelize.Transaction) {
  const url = getActivityPubUrl('video', video.uuid) + '#announce'

  const videoChannel = video.VideoChannel
  const announcedActivity = await addActivityData(url, videoChannel.Account, videoChannel.url, video.toActivityPubObject(), true)

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, [ byAccount ], t)
}

async function sendVideoAbuse (
  fromAccount: AccountInstance,
  videoAbuse: VideoAbuseInstance,
  video: VideoInstance,
  t: Sequelize.Transaction
) {
  const url = getActivityPubUrl('videoAbuse', videoAbuse.id.toString())
  const data = await createActivityData(url, fromAccount, video.url)

  return unicastTo(data, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendAccept (fromAccount: AccountInstance, toAccount: AccountInstance, t: Sequelize.Transaction) {
  const data = await acceptActivityData(fromAccount)

  return unicastTo(data, toAccount.inboxUrl, t)
}

async function sendFollow (fromAccount: AccountInstance, toAccount: AccountInstance, t: Sequelize.Transaction) {
  const data = await followActivityData(toAccount.url, fromAccount)

  return unicastTo(data, toAccount.inboxUrl, t)
}

// ---------------------------------------------------------------------------

export {
  sendCreateVideoChannel,
  sendUpdateVideoChannel,
  sendDeleteVideoChannel,
  sendAddVideo,
  sendUpdateVideo,
  sendDeleteVideo,
  sendDeleteAccount,
  sendAccept,
  sendFollow,
  sendVideoAbuse,
  sendVideoChannelAnnounce,
  sendVideoAnnounce
}

// ---------------------------------------------------------------------------

async function broadcastToFollowers (data: any, toAccountFollowers: AccountInstance[], t: Sequelize.Transaction) {
  const toAccountFollowerIds = toAccountFollowers.map(a => a.id)
  const result = await db.AccountFollow.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds)
  if (result.data.length === 0) {
    logger.info('Not broadcast because of 0 followers for %s.', toAccountFollowerIds.join(', '))
    return
  }

  const jobPayload = {
    uris: result.data,
    body: data
  }

  return httpRequestJobScheduler.createJob(t, 'httpRequestBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, toAccountUrl: string, t: Sequelize.Transaction) {
  const jobPayload = {
    uris: [ toAccountUrl ],
    body: data
  }

  return httpRequestJobScheduler.createJob(t, 'httpRequestUnicastHandler', jobPayload)
}

function buildSignedActivity (byAccount: AccountInstance, data: Object) {
  const activity = activityPubContextify(data)

  return signObject(byAccount, activity) as Promise<Activity>
}

async function getPublicActivityTo (account: AccountInstance) {
  const inboxUrls = await account.getFollowerSharedInboxUrls()

  return inboxUrls.concat('https://www.w3.org/ns/activitystreams#Public')
}

async function createActivityData (url: string, byAccount: AccountInstance, object: any, raw = false) {
  const to = await getPublicActivityTo(byAccount)
  const base = {
    type: 'Create',
    id: url,
    actor: byAccount.url,
    to,
    object
  }

  if (raw === true) return base

  return buildSignedActivity(byAccount, base)
}

async function updateActivityData (url: string, byAccount: AccountInstance, object: any) {
  const to = await getPublicActivityTo(byAccount)
  const base = {
    type: 'Update',
    id: url,
    actor: byAccount.url,
    to,
    object
  }

  return buildSignedActivity(byAccount, base)
}

async function deleteActivityData (url: string, byAccount: AccountInstance) {
  const base = {
    type: 'Delete',
    id: url,
    actor: byAccount.url
  }

  return buildSignedActivity(byAccount, base)
}

async function addActivityData (url: string, byAccount: AccountInstance, target: string, object: any, raw = false) {
  const to = await getPublicActivityTo(byAccount)
  const base = {
    type: 'Add',
    id: url,
    actor: byAccount.url,
    to,
    object,
    target
  }

  if (raw === true) return base

  return buildSignedActivity(byAccount, base)
}

async function announceActivityData (url: string, byAccount: AccountInstance, object: any) {
  const base = {
    type: 'Announce',
    id: url,
    actor: byAccount.url,
    object
  }

  return buildSignedActivity(byAccount, base)
}

async function followActivityData (url: string, byAccount: AccountInstance) {
  const base = {
    type: 'Follow',
    id: byAccount.url,
    actor: byAccount.url,
    object: url
  }

  return buildSignedActivity(byAccount, base)
}

async function acceptActivityData (byAccount: AccountInstance) {
  const base = {
    type: 'Accept',
    id: byAccount.url,
    actor: byAccount.url
  }

  return buildSignedActivity(byAccount, base)
}
