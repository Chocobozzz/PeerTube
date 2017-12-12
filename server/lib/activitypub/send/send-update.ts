import { Transaction } from 'sequelize'
import { ActivityUpdate } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoChannelShareModel } from '../../../models/video/video-channel-share'
import { VideoShareModel } from '../../../models/video/video-share'
import { getUpdateActivityPubUrl } from '../url'
import { broadcastToFollowers, getAudience } from './misc'

async function sendUpdateVideoChannel (videoChannel: VideoChannelModel, t: Transaction) {
  const byAccount = videoChannel.Account

  const url = getUpdateActivityPubUrl(videoChannel.url, videoChannel.updatedAt.toISOString())
  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await updateActivityData(url, byAccount, videoChannelObject, t)

  const accountsInvolved = await VideoChannelShareModel.loadAccountsByShare(videoChannel.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendUpdateVideo (video: VideoModel, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())
  const videoObject = video.toActivityPubObject()
  const data = await updateActivityData(url, byAccount, videoObject, t)

  const accountsInvolved = await VideoShareModel.loadAccountsByShare(video.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateVideoChannel,
  sendUpdateVideo
}

// ---------------------------------------------------------------------------

async function updateActivityData (url: string, byAccount: AccountModel, object: any, t: Transaction): Promise<ActivityUpdate> {
  const { to, cc } = await getAudience(byAccount, t)
  return {
    type: 'Update',
    id: url,
    actor: byAccount.url,
    to,
    cc,
    object
  }
}
