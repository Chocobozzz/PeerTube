import { Transaction } from 'sequelize'
import { ActivityAdd } from '../../../../shared/index'
import { ActivityAnnounce, ActivityCreate } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoInstance } from '../../../models'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { getAnnounceActivityPubUrl } from '../url'
import { broadcastToFollowers } from './misc'
import { addActivityData } from './send-add'
import { createActivityData } from './send-create'

async function sendVideoAnnounce (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(video.url, byAccount)

  const videoChannel = video.VideoChannel
  const announcedActivity = await addActivityData(url, videoChannel.Account, video, videoChannel.url, video.toActivityPubObject())

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoChannelAnnounce (byAccount: AccountInstance, videoChannel: VideoChannelInstance, t: Transaction) {
  const url = getAnnounceActivityPubUrl(videoChannel.url, byAccount)
  const announcedActivity = await createActivityData(url, videoChannel.Account, videoChannel.toActivityPubObject())

  const data = await announceActivityData(url, byAccount, announcedActivity)
  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function announceActivityData (url: string, byAccount: AccountInstance, object: ActivityCreate | ActivityAdd) {
  const activity: ActivityAnnounce = {
    type: 'Announce',
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}

// ---------------------------------------------------------------------------

export {
  sendVideoAnnounce,
  sendVideoChannelAnnounce,
  announceActivityData
}
