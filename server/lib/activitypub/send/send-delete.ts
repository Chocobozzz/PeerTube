import { Transaction } from 'sequelize'
import { ActivityDelete } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoChannelShareModel } from '../../../models/video/video-channel-share'
import { VideoShareModel } from '../../../models/video/video-share'
import { broadcastToFollowers } from './misc'

async function sendDeleteVideoChannel (videoChannel: VideoChannelModel, t: Transaction) {
  const byAccount = videoChannel.Account

  const data = deleteActivityData(videoChannel.url, byAccount)

  const accountsInvolved = await VideoChannelShareModel.loadAccountsByShare(videoChannel.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendDeleteVideo (video: VideoModel, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const data = deleteActivityData(video.url, byAccount)

  const accountsInvolved = await VideoShareModel.loadAccountsByShare(video.id, t)
  accountsInvolved.push(byAccount)

  return broadcastToFollowers(data, byAccount, accountsInvolved, t)
}

async function sendDeleteAccount (account: AccountModel, t: Transaction) {
  const data = deleteActivityData(account.url, account)

  return broadcastToFollowers(data, account, [ account ], t)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideoChannel,
  sendDeleteVideo,
  sendDeleteAccount
}

// ---------------------------------------------------------------------------

function deleteActivityData (url: string, byAccount: AccountModel): ActivityDelete {
  return {
    type: 'Delete',
    id: url,
    actor: byAccount.url
  }
}
