import { ActivityAccept } from '../../../../shared/models/activitypub'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'
import { addFetchOutboxJob } from '../fetch'

async function processAcceptActivity (activity: ActivityAccept, inboxAccount?: AccountModel) {
  if (inboxAccount === undefined) throw new Error('Need to accept on explicit inbox.')

  const targetAccount = await AccountModel.loadByUrl(activity.actor)

  return processAccept(inboxAccount, targetAccount)
}

// ---------------------------------------------------------------------------

export {
  processAcceptActivity
}

// ---------------------------------------------------------------------------

async function processAccept (account: AccountModel, targetAccount: AccountModel) {
  const follow = await AccountFollowModel.loadByAccountAndTarget(account.id, targetAccount.id)
  if (!follow) throw new Error('Cannot find associated follow.')

  follow.set('state', 'accepted')
  await follow.save()
  await addFetchOutboxJob(targetAccount, undefined)
}
