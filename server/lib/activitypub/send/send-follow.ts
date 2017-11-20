import { Transaction } from 'sequelize'
import { ActivityFollow } from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { unicastTo } from './misc'
import { getAccountFollowActivityPubUrl } from '../../../helpers/activitypub'

async function sendFollow (accountFollow: AccountFollowInstance, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const url = getAccountFollowActivityPubUrl(accountFollow)
  const data = await followActivityData(url, me, following)

  return unicastTo(data, me, following.inboxUrl, t)
}

async function followActivityData (url: string, byAccount: AccountInstance, targetAccount: AccountInstance) {
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
