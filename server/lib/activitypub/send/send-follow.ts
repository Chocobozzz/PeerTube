import { Transaction } from 'sequelize'
import { ActivityFollow } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'
import { getAccountFollowActivityPubUrl } from '../url'
import { unicastTo } from './misc'

function sendFollow (accountFollow: AccountFollowModel, t: Transaction) {
  const me = accountFollow.AccountFollower
  const following = accountFollow.AccountFollowing

  const url = getAccountFollowActivityPubUrl(accountFollow)
  const data = followActivityData(url, me, following)

  return unicastTo(data, me, following.inboxUrl, t)
}

function followActivityData (url: string, byAccount: AccountModel, targetAccount: AccountModel): ActivityFollow {
  return {
    type: 'Follow',
    id: url,
    actor: byAccount.url,
    object: targetAccount.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendFollow,
  followActivityData
}
