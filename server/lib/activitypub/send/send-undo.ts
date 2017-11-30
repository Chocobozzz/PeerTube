import { Transaction } from 'sequelize'
import {
  ActivityAudience,
  ActivityCreate,
  ActivityFollow,
  ActivityLike,
  ActivityUndo
} from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { VideoInstance } from '../../../models/video/video-interface'
import { getAccountFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getAccountsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'
import { createActivityData, createDislikeActivityData } from './send-create'
import { followActivityData } from './send-follow'
import { likeActivityData } from './send-like'

async function sendUndoFollow (accountFollow: AccountFollowInstance, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const followUrl = getAccountFollowActivityPubUrl(accountFollow)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const object = followActivityData(followUrl, me, following)
  const data = await undoActivityData(undoUrl, me, object, t)

  return unicastTo(data, me, following.inboxUrl, t)
}

async function sendUndoLikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const object = await likeActivityData(likeUrl, byAccount, video, t)
  const data = await undoActivityData(undoUrl, byAccount, object, t, audience)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendUndoLikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const toAccountsFollowers = await getAccountsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(toAccountsFollowers)
  const object = await likeActivityData(likeUrl, byAccount, video, t)
  const data = await undoActivityData(undoUrl, byAccount, object, t, audience)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, toAccountsFollowers, t, followersException)
}

async function sendUndoDislikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const accountsInvolvedInVideo = await getAccountsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, accountsInvolvedInVideo)
  const dislikeActivity = createDislikeActivityData(byAccount, video)
  const object = await createActivityData(undoUrl, byAccount, dislikeActivity, t, audience)

  const data = await undoActivityData(undoUrl, byAccount, object, t)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendUndoDislikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const dislikeActivity = createDislikeActivityData(byAccount, video)
  const object = await createActivityData(undoUrl, byAccount, dislikeActivity, t)

  const data = await undoActivityData(undoUrl, byAccount, object, t)

  const toAccountsFollowers = await getAccountsInvolvedInVideo(video, t)

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, byAccount, toAccountsFollowers, t, followersException)
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow,
  sendUndoLikeToOrigin,
  sendUndoLikeToVideoFollowers,
  sendUndoDislikeToOrigin,
  sendUndoDislikeToVideoFollowers
}

// ---------------------------------------------------------------------------

async function undoActivityData (
  url: string,
  byAccount: AccountInstance,
  object: ActivityFollow | ActivityLike | ActivityCreate,
  t: Transaction,
  audience?: ActivityAudience
) {
  if (!audience) {
    audience = await getAudience(byAccount, t)
  }

  const activity: ActivityUndo = {
    type: 'Undo',
    id: url,
    actor: byAccount.url,
    to: audience.to,
    cc: audience.cc,
    object
  }

  return activity
}
