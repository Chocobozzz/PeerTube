import { Transaction } from 'sequelize'
import { ActivityAdd } from '../../../../shared/models/activitypub/activity'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import { AccountInstance, VideoInstance } from '../../../models'
import { broadcastToFollowers, getAudience } from './misc'

async function sendAddVideo (video: VideoInstance, t: Transaction) {
  const byAccount = video.VideoChannel.Account

  const videoObject = video.toActivityPubObject()
  const data = await addActivityData(video.url, byAccount, video, video.VideoChannel.url, videoObject, t)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function addActivityData (
  url: string,
  byAccount: AccountInstance,
  video: VideoInstance,
  target: string,
  object: any,
  t: Transaction
) {
  const videoPublic = video.privacy === VideoPrivacy.PUBLIC

  const { to, cc } = await getAudience(byAccount, t, videoPublic)
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

// ---------------------------------------------------------------------------

export {
  addActivityData,
  sendAddVideo
}
