import { Transaction } from 'sequelize'
import {
  ActivityAccept,
  ActivityAdd,
  ActivityCreate,
  ActivityDelete,
  ActivityFollow,
  ActivityUpdate
} from '../../../shared/models/activitypub/activity'
import { getActivityPubUrl } from '../../helpers/activitypub'
import { logger } from '../../helpers/logger'
import { database as db } from '../../initializers'
import { AccountInstance, VideoChannelInstance, VideoInstance } from '../../models'
import { VideoAbuseInstance } from '../../models/video/video-abuse-interface'
import { activitypubHttpJobScheduler } from '../jobs'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { VideoPrivacy } from '../../../shared/models/videos/video-privacy.enum'

async function sendCreateVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await createActivityData(videoChannel.url, byAccount, videoChannelObject)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendUpdateVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await updateActivityData(videoChannel.url, byAccount, videoChannelObject)

  const accountsInvolved = await db.VideoChannelShare.loadAccountsByShare(videoChannel.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendDeleteVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const data = await deleteActivityData(videoChannel.url, byAccount)

  const accountsInvolved = await db.VideoChannelShare.loadAccountsByShare(videoChannel.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendAddVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const videoObject = video.toActivityPubObject()
  const data = await addActivityData(video.url, byAccount, video, video.VideoChannel.url, videoObject)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendUpdateVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const videoObject = video.toActivityPubObject()
  const data = await updateActivityData(video.url, byAccount, videoObject)

  const accountsInvolved = await db.VideoShare.loadAccountsByShare(video.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendDeleteVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const data = await deleteActivityData(video.url, byAccount)

  const accountsInvolved = await db.VideoShare.loadAccountsByShare(video.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendDeleteAccount (account: AccountInstance, t: Transaction) {
  const data = await deleteActivityData(account.url, account)

  return broadcastToFollowers(data, account, [ account ], t)
}

async function sendVideoChannelAnnounce (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Transaction) {
  const url = getActivityPubUrl('videoChannel', videoChannel.uuid) + '#announce'
  const announcedActivity = await createActivityData(url, videoChannel.Account, videoChannel.toActivityPubObject())

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAnnounce (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getActivityPubUrl('video', video.uuid) + '#announce'

  const videoChannel = video.VideoChannel
  const announcedActivity = await addActivityData(url, videoChannel.Account, video, videoChannel.url, video.toActivityPubObject())

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAbuse (byAccount: AccountInstance, videoAbuse: VideoAbuseInstance, video: VideoInstance, t: Transaction) {
  const url = getActivityPubUrl('videoAbuse', videoAbuse.id.toString())
  const data = await createActivityData(url, byAccount, videoAbuse.toActivityPubObject())

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendAccept (byAccount: AccountInstance, toAccount: AccountInstance, t: Transaction) {
  const data = await acceptActivityData(byAccount)

  return unicastTo(data, byAccount, toAccount.inboxUrl, t)
}

async function sendFollow (byAccount: AccountInstance, toAccount: AccountInstance, t: Transaction) {
  const data = await followActivityData(toAccount.url, byAccount)

  return unicastTo(data, byAccount, toAccount.inboxUrl, t)
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

async function broadcastToFollowers (data: any, byAccount: AccountInstance, toAccountFollowers: AccountInstance[], t: Transaction) {
  const toAccountFollowerIds = toAccountFollowers.map(a => a.id)
  const result = await db.AccountFollow.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds)
  if (result.data.length === 0) {
    logger.info('Not broadcast because of 0 followers for %s.', toAccountFollowerIds.join(', '))
    return
  }

  const jobPayload = {
    uris: result.data,
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, byAccount: AccountInstance, toAccountUrl: string, t: Transaction) {
  const jobPayload = {
    uris: [ toAccountUrl ],
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpUnicastHandler', jobPayload)
}

async function getAudience (accountSender: AccountInstance, isPublic = true) {
  const followerInboxUrls = await accountSender.getFollowerSharedInboxUrls()

  // Thanks Mastodon: https://github.com/tootsuite/mastodon/blob/master/app/lib/activitypub/tag_manager.rb#L47
  let to = []
  let cc = []

  if (isPublic) {
    to = [ ACTIVITY_PUB.PUBLIC ]
    cc = followerInboxUrls
  } else { // Unlisted
    to = followerInboxUrls
    cc = [ ACTIVITY_PUB.PUBLIC ]
  }

  return { to, cc }
}

async function createActivityData (url: string, byAccount: AccountInstance, object: any) {
  const { to, cc } = await getAudience(byAccount)
  const activity: ActivityCreate = {
    type: 'Create',
    id: url,
    actor: byAccount.url,
    to,
    cc,
    object
  }

  return activity
}

async function updateActivityData (url: string, byAccount: AccountInstance, object: any) {
  const { to, cc } = await getAudience(byAccount)
  const activity: ActivityUpdate = {
    type: 'Update',
    id: url,
    actor: byAccount.url,
    to,
    cc,
    object
  }

  return activity
}

async function deleteActivityData (url: string, byAccount: AccountInstance) {
  const activity: ActivityDelete = {
    type: 'Delete',
    id: url,
    actor: byAccount.url
  }

  return activity
}

async function addActivityData (url: string, byAccount: AccountInstance, video: VideoInstance, target: string, object: any) {
  const videoPublic = video.privacy === VideoPrivacy.PUBLIC

  const { to, cc } = await getAudience(byAccount, videoPublic)
  const activity: ActivityAdd = {
    type: 'Add',
    id: url,
    actor: byAccount.url,
    to,
    cc,
    object,
    target
  }

  return activity
}

async function announceActivityData (url: string, byAccount: AccountInstance, object: any) {
  const activity = {
    type: 'Announce',
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}

async function followActivityData (url: string, byAccount: AccountInstance) {
  const activity: ActivityFollow = {
    type: 'Follow',
    id: byAccount.url,
    actor: byAccount.url,
    object: url
  }

  return activity
}

async function acceptActivityData (byAccount: AccountInstance) {
  const activity: ActivityAccept = {
    type: 'Accept',
    id: byAccount.url,
    actor: byAccount.url
  }

  return activity
}
