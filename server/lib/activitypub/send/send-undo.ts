import { Transaction } from 'sequelize'
import { ActivityFollow, ActivityUndo } from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { unicastTo } from './misc'
import { followActivityData } from './send-follow'
import { getAccountFollowActivityPubUrl, getUndoActivityPubUrl } from '../url'

async function sendUndoFollow (accountFollow: AccountFollowInstance, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const followUrl = getAccountFollowActivityPubUrl(accountFollow)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const object = await followActivityData(followUrl, me, following)
  const data = await undoActivityData(undoUrl, me, object)

  return unicastTo(data, me, following.inboxUrl, t)
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow
}

// ---------------------------------------------------------------------------

async function undoActivityData (url: string, byAccount: AccountInstance, object: ActivityFollow) {
  const activity: ActivityUndo = {
    type: 'Undo',
    id: url,
    actor: byAccount.url,
    object
  }

  return activity
}
