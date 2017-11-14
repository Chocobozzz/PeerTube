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

function sendCreateVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = createActivityData(videoChannel.url, videoChannel.Account, videoChannelObject)

  return broadcastToFollowers(data, videoChannel.Account, t)
}

function sendUpdateVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = updateActivityData(videoChannel.url, videoChannel.Account, videoChannelObject)

  return broadcastToFollowers(data, videoChannel.Account, t)
}

function sendDeleteVideoChannel (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const data = deleteActivityData(videoChannel.url, videoChannel.Account)

  return broadcastToFollowers(data, videoChannel.Account, t)
}

function sendAddVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const videoObject = video.toActivityPubObject()
  const data = addActivityData(video.url, video.VideoChannel.Account, video.VideoChannel.url, videoObject)

  return broadcastToFollowers(data, video.VideoChannel.Account, t)
}

function sendUpdateVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const videoObject = video.toActivityPubObject()
  const data = updateActivityData(video.url, video.VideoChannel.Account, videoObject)

  return broadcastToFollowers(data, video.VideoChannel.Account, t)
}

function sendDeleteVideo (video: VideoInstance, t: Sequelize.Transaction) {
  const data = deleteActivityData(video.url, video.VideoChannel.Account)

  return broadcastToFollowers(data, video.VideoChannel.Account, t)
}

function sendDeleteAccount (account: AccountInstance, t: Sequelize.Transaction) {
  const data = deleteActivityData(account.url, account)

  return broadcastToFollowers(data, account, t)
}

function sendAccept (fromAccount: AccountInstance, toAccount: AccountInstance, t: Sequelize.Transaction) {
  const data = acceptActivityData(fromAccount)

  return unicastTo(data, toAccount, t)
}

function sendFollow (fromAccount: AccountInstance, toAccount: AccountInstance, t: Sequelize.Transaction) {
  const data = followActivityData(toAccount.url, fromAccount)

  return unicastTo(data, toAccount, t)
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
  sendFollow
}

// ---------------------------------------------------------------------------

async function broadcastToFollowers (data: any, fromAccount: AccountInstance, t: Sequelize.Transaction) {
  const result = await db.Account.listAcceptedFollowerUrlsForApi(fromAccount.id, 0)

  const jobPayload = {
    uris: result.data,
    body: data
  }

  return httpRequestJobScheduler.createJob(t, 'httpRequestBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, toAccount: AccountInstance, t: Sequelize.Transaction) {
  const jobPayload = {
    uris: [ toAccount.url ],
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

async function createActivityData (url: string, byAccount: AccountInstance, object: any) {
  const to = await getPublicActivityTo(byAccount)
  const base = {
    type: 'Create',
    id: url,
    actor: byAccount.url,
    to,
    object
  }

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

async function addActivityData (url: string, byAccount: AccountInstance, target: string, object: any) {
  const to = await getPublicActivityTo(byAccount)
  const base = {
    type: 'Add',
    id: url,
    actor: byAccount.url,
    to,
    object,
    target
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
