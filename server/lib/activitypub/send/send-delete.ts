import { Transaction } from 'sequelize'
import { ActivityDelete } from '../../../../shared/models/activitypub/activity'
import { database as db } from '../../../initializers'
import { AccountInstance, VideoChannelInstance, VideoInstance } from '../../../models'
import { broadcastToFollowers } from './misc'

async function sendDeleteVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const data = await deleteActivityData(videoChannel.url, byAccount)

  const accountsInvolved = await db.VideoChannelShare.loadAccountsByShare(videoChannel.id)
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

// ---------------------------------------------------------------------------

export {
  sendDeleteVideoChannel,
  sendDeleteVideo,
  sendDeleteAccount
}

// ---------------------------------------------------------------------------

async function deleteActivityData (url: string, byAccount: AccountInstance) {
  const activity: ActivityDelete = {
    type: 'Delete',
    id: url,
    actor: byAccount.url
  }

  return activity
}
