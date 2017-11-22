import { Transaction } from 'sequelize'
import { ActivityCreate } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoChannelInstance, VideoInstance } from '../../../models'
import { VideoAbuseInstance } from '../../../models/video/video-abuse-interface'
import { broadcastToFollowers, getAudience, unicastTo } from './misc'
import { getVideoAbuseActivityPubUrl } from '../url'

async function sendCreateVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await createActivityData(videoChannel.url, byAccount, videoChannelObject)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAbuse (byAccount: AccountInstance, videoAbuse: VideoAbuseInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoAbuseActivityPubUrl(videoAbuse)
  const data = await createActivityData(url, byAccount, videoAbuse.toActivityPubObject())

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

// async function sendCreateView ()

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

// ---------------------------------------------------------------------------

export {
  sendCreateVideoChannel,
  sendVideoAbuse,
  createActivityData
}
