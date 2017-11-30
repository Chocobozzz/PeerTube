import { Transaction } from 'sequelize'
import { ActivityFollow } from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { getAccountFollowActivityPubUrl } from '../url'
import { unicastTo } from './misc'

function sendFollow (accountFollow: AccountFollowInstance, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const url = getAccountFollowActivityPubUrl(accountFollow)
  const data = followActivityData(url, me, following)

  return unicastTo(data, me, following.inboxUrl, t)
}

function followActivityData (url: string, byAccount: AccountInstance, targetAccount: AccountInstance) {
  const activity: ActivityFollow = {
    type: 'Follow',
    id: url,
    actor: byAccount.url,
    object: targetAccount.url
  }

  return activity
}

// ---------------------------------------------------------------------------

export {
  sendFollow,
  followActivityData
}
