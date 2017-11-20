import { Transaction } from 'sequelize'
import { AccountInstance, VideoInstance } from '../../../models'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { broadcastToFollowers } from './misc'
import { addActivityData } from './send-add'
import { createActivityData } from './send-create'
import { getAnnounceActivityPubUrl } from '../url'

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

// ---------------------------------------------------------------------------

export {
  sendVideoAnnounce,
  sendVideoChannelAnnounce
}

// ---------------------------------------------------------------------------

async function announceActivityData (url: string, byAccount: AccountInstance, object: any) {
  const activity = {
    type: 'Announce',
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}
