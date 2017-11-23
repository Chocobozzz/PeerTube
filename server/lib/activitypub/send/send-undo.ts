import { Transaction } from 'sequelize'
import { ActivityCreate, ActivityFollow, ActivityLike, ActivityUndo } from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { broadcastToFollowers, getAccountsToForwardVideoAction, unicastTo } from './misc'
import { followActivityData } from './send-follow'
import { getAccountFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import { VideoInstance } from '../../../models/video/video-interface'
import { likeActivityData } from './send-like'
import { createActivityData, createDislikeActivityData } from './send-create'
import { getServerAccount } from '../../../helpers/utils'

async function sendUndoFollow (accountFollow: AccountFollowInstance, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const followUrl = getAccountFollowActivityPubUrl(accountFollow)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const object = await followActivityData(followUrl, me, following)
  const data = await undoActivityData(undoUrl, me, object)

  return unicastTo(data, me, following.inboxUrl, t)
}

async function sendUndoLikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const object = await likeActivityData(likeUrl, byAccount, video)
  const data = await undoActivityData(undoUrl, byAccount, object)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendUndoLikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const object = await likeActivityData(likeUrl, byAccount, video)
  const data = await undoActivityData(undoUrl, byAccount, object)

  const accountsToForwardView = await getAccountsToForwardVideoAction(byAccount, video)
  const serverAccount = await getServerAccount()

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, serverAccount, accountsToForwardView, t, followersException)
}

async function sendUndoDislikeToOrigin (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const dislikeActivity = createDislikeActivityData(byAccount, video)
  const object = await createActivityData(undoUrl, byAccount, dislikeActivity)

  const data = await undoActivityData(undoUrl, byAccount, object)

  return unicastTo(data, byAccount, video.VideoChannel.Account.sharedInboxUrl, t)
}

async function sendUndoDislikeToVideoFollowers (byAccount: AccountInstance, video: VideoInstance, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byAccount, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const dislikeActivity = createDislikeActivityData(byAccount, video)
  const object = await createActivityData(undoUrl, byAccount, dislikeActivity)

  const data = await undoActivityData(undoUrl, byAccount, object)

  const accountsToForwardView = await getAccountsToForwardVideoAction(byAccount, video)
  const serverAccount = await getServerAccount()

  const followersException = [ byAccount ]
  return broadcastToFollowers(data, serverAccount, accountsToForwardView, t, followersException)
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

async function undoActivityData (url: string, byAccount: AccountInstance, object: ActivityFollow | ActivityLike | ActivityCreate) {
  const activity: ActivityUndo = {
    type: 'Undo',
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}
