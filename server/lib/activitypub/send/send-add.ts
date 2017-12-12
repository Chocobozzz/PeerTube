import { Transaction } from 'sequelize'
import { ActivityAdd } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { broadcastToFollowers, getAudience } from './misc'

async function sendAddVideo (video: VideoModel, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const videoObject = video.toActivityPubObject()
  const data = await addActivityData(video.url, byAccount, video, video.VideoChannel.url, videoObject, t)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function addActivityData (
  url: string,
  byAccount: AccountModel,
  video: VideoModel,
  target: string,
  object: any,
  t: Transaction
): Promise<ActivityAdd> {
  const videoPublic = video.privacy === VideoPrivacy.PUBLIC

  const { to, cc } = await getAudience(byAccount, t, videoPublic)

  return {
    type: 'Add',
    id: url,
    actor: byAccount.url,
    to,
    cc,
    object,
    target
  }
}

// ---------------------------------------------------------------------------

export {
  addActivityData,
  sendAddVideo
}
