import { Transaction } from 'sequelize'
import { ActivityAccept } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'
import { getAccountFollowAcceptActivityPubUrl } from '../url'
import { unicastTo } from './misc'

async function sendAccept (accountFollow: AccountFollowModel, t: Transaction) {
  const follower = accountFollow.AccountFollower
  const me = accountFollow.AccountFollowing

  const url = getAccountFollowAcceptActivityPubUrl(accountFollow)
  const data = acceptActivityData(url, me)

  return unicastTo(data, me, follower.inboxUrl, t)
}

// ---------------------------------------------------------------------------

export {
  sendAccept
}

// ---------------------------------------------------------------------------

function acceptActivityData (url: string, byAccount: AccountModel) {
  const activity: ActivityAccept = {
    type: 'Accept',
    id: url,
    actor: byAccount.url
  }

  return activity
}
