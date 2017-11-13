import { ActivityAccept } from '../../../shared/models/activitypub/activity'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'

async function processAcceptActivity (activity: ActivityAccept, inboxAccount?: AccountInstance) {
  if (inboxAccount === undefined) throw new Error('Need to accept on explicit inbox.')

  const targetAccount = await db.Account.loadByUrl(activity.actor)

  return processFollow(inboxAccount, targetAccount)
}

// ---------------------------------------------------------------------------

export {
  processAcceptActivity
}

// ---------------------------------------------------------------------------

async function processFollow (account: AccountInstance, targetAccount: AccountInstance) {
  const follow = await db.AccountFollow.loadByAccountAndTarget(account.id, targetAccount.id)
  if (!follow) throw new Error('Cannot find associated follow.')

  follow.set('state', 'accepted')
  return follow.save()
}
