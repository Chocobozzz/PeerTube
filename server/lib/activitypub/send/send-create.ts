import { Transaction } from 'sequelize'
import { ActivityCreate } from '../../../../shared/models/activitypub/activity'
import { AccountInstance, VideoChannelInstance, VideoInstance } from '../../../models'
import { VideoAbuseInstance } from '../../../models/video/video-abuse-interface'
import { broadcastToFollowers, getAudience, unicastTo } from './misc'
import { getVideoAbuseActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import { getServerAccount } from '../../../helpers/utils'
import { database as db } from '../../../initializers'

async function sendCreateVideoChannel (videoChannel: VideoChannelInstance, t: Transaction) {
  const byAccount = videoChannel.Account

  const videoChannelObject = videoChannel.toActivityPubObject()
  const data = await createActivityData(videoChannel.url, byAccount, videoChannelObject)

  return broadcastToFollowers(data, byAccount, [ byAccount ], t)
}

async function sendVideoAbuse (byAccount: AccountInstance, videoAbuse: VideoAbuseInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  const audience = { to: [ video.VideoChannel.Account.url ], cc: [] }
  const data = await createActivityData(url, byAccount, videoAbuse.toActivityPubObject(), audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendCreateViewToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byAccount, video)
  const viewActivity = createViewActivityData(byAccount, video)

  const audience = { to: [ video.VideoChannel.Account.url ], cc: [ video.VideoChannel.Account.url + '/followers' ] }
  const data = await createActivityData(url, byAccount, viewActivity, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendCreateViewToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byAccount, video)
  const viewActivity = createViewActivityData(byAccount, video)

  const audience = { to: [ video.VideoChannel.Account.url + '/followers' ], cc: [] }
  const data = await createActivityData(url, byAccount, viewActivity, audience)

  const serverAccount = await getServerAccount()
  const accountsToForwardView = await db.VideoShare.loadAccountsByShare(video.id)
  accountsToForwardView.push(video.VideoChannel.Account)

  // Don't forward view to server that sent it to us
  const index = accountsToForwardView.findIndex(a => a.id === byAccount.id)
  if (index) accountsToForwardView.splice(index, 1)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, serverAccount, accountsToForwardView, t, followersException)
}

async function createActivityData (url: string, byAccount: AccountInstance, object: any, audience?: { to: string[], cc: string[] }) {
  if (!audience) {
    audience = await getAudience(byAccount)
  }

  const activity: ActivityCreate = {
    type: 'Create',
    id: url,
    actor: byAccount.url,
    to: audience.to,
    cc: audience.cc,
    object
  }

  return activity
}

// ---------------------------------------------------------------------------

export {
  sendCreateVideoChannel,
  sendVideoAbuse,
  createActivityData,
  sendCreateViewToOrigin,
  sendCreateViewToVideoFollowers
}

// ---------------------------------------------------------------------------

function createViewActivityData (byAccount: AccountInstance, video: VideoInstance) {
  const obj = {
    type: 'View',
    actor: byAccount.url,
    object: video.url
  }

  return obj
}
