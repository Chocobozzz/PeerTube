import { ActivityFollow } from '../../../shared/models/activitypub/activity'
import { getOrCreateAccount } from '../../helpers'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'

async function processFollowActivity (activity: ActivityFollow) {
  const activityObject = activity.object
  const account = await getOrCreateAccount(activity.actor)

  return processFollow(account, activityObject)
}

// ---------------------------------------------------------------------------

export {
  processFollowActivity
}

// ---------------------------------------------------------------------------

async function processFollow (account: AccountInstance, targetAccountURL: string) {
  const targetAccount = await db.Account.loadByUrl(targetAccountURL)

  if (targetAccount === undefined) throw new Error('Unknown account')
  if (targetAccount.isOwned() === false) throw new Error('This is not a local account.')

  return db.AccountFollow.create({
    accountId: account.id,
    targetAccountId: targetAccount.id,
    state: 'accepted'
  })
}
