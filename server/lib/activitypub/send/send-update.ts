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
  const data = await updateActivityData(url, byAccount, videoChannelObject)

  const accountsInvolved = await db.VideoChannelShare.loadAccountsByShare(videoChannel.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendUpdateVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())
  const videoObject = video.toActivityPubObject()
  const data = await updateActivityData(url, byAccount, videoObject)

  const accountsInvolved = await db.VideoShare.loadAccountsByShare(video.id)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateVideoChannel,
  sendUpdateVideo
}

// ---------------------------------------------------------------------------

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
