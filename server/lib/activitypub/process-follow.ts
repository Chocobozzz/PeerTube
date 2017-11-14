import { ActivityFollow } from '../../../shared/models/activitypub/activity'
import { getOrCreateAccount, retryTransactionWrapper } from '../../helpers'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'
import { sendAccept } from './send-request'
import { logger } from '../../helpers/logger'

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

function processFollow (account: AccountInstance, targetAccountURL: string) {
  const options = {
    arguments: [ account, targetAccountURL ],
    errorMessage: 'Cannot follow with many retries.'
  }

  return retryTransactionWrapper(follow, options)
}

async function follow (account: AccountInstance, targetAccountURL: string) {
  await db.sequelize.transaction(async t => {
    const targetAccount = await db.Account.loadByUrl(targetAccountURL, t)

    if (targetAccount === undefined) throw new Error('Unknown account')
    if (targetAccount.isOwned() === false) throw new Error('This is not a local account.')

    await db.AccountFollow.findOrCreate({
      where: {
        accountId: account.id,
        targetAccountId: targetAccount.id
      },
      defaults: {
        accountId: account.id,
        targetAccountId: targetAccount.id,
        state: 'accepted'
      },
      transaction: t
    })

    // Target sends to account he accepted the follow request
    return sendAccept(targetAccount, account, t)
  })

  logger.info('Account uuid %s is followed by account %s.', account.url, targetAccountURL)
}
