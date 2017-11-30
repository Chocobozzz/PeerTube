import { Transaction } from 'sequelize'
import { ActivityAccept } from '../../../../shared/models/activitypub/activity'
import { AccountInstance } from '../../../models'
import { AccountFollowInstance } from '../../../models/account/account-follow-interface'
import { unicastTo } from './misc'
import { getAccountFollowAcceptActivityPubUrl } from '../url'

async function sendAccept (accountFollow: AccountFollowInstance, t: Transaction) {
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

function acceptActivityData (url: string, byAccount: AccountInstance) {
  const activity: ActivityAccept = {
    type: 'Accept',
    id: url,
    actor: byAccount.url
  }

  return activity
}
