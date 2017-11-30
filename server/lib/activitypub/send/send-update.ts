import { Transaction } from 'sequelize'
import { ActivityUpdate } from '../../../../shared/models/activitypub/activity'
import { database as db } from '../../../initializers'
import { AccountInstance, VideoChannelInstance, VideoInstance } from '../../../models'
import { getUpdateActivityPubUrl } from '../url'
import { broadcastToFollowers, getAudience } from './misc'

async function sendUpdateVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const url = getUpdateActivityPubUrl(videoChannel.url, videoChannel.updatedAt.toISOString())
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await updateActivityData(url, byAccount, videoChannelObject, t)

  const accountsInvolved = await db.VideoChannelShare.loadAccountsByShare(videoChannel.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendUpdateVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())
  const videoObject = video.toActivityPubObject()
  const data = await updateActivityData(url, byAccount, videoObject, t)

  const accountsInvolved = await db.VideoShare.loadAccountsByShare(video.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateVideoChannel,
  sendUpdateVideo
}

// ---------------------------------------------------------------------------

async function updateActivityData (url: string, byAccount: AccountInstance, object: any, t: Transaction) {
  const { to, cc } = await getAudience(byAccount, t)
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
