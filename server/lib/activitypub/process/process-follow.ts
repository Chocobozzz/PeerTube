import { ActivityFollow } from '../../../../shared/models/activitypub/activity'
import { retryTransactionWrapper } from '../../../helpers'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { logger } from '../../../helpers/logger'
import { sendAccept } from '../send/send-accept'
import { getOrCreateAccountAndServer } from '../account'

async function processFollowActivity (activity: ActivityFollow) {
  const activityObject = activity.object
  const account = await getOrCreateAccountAndServer(activity.actor)

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

    if (!targetAccount) throw new Error('Unknown account')
    if (targetAccount.isOwned() === false) throw new Error('This is not a local account.')

    const [ accountFollow ] = await db.AccountFollow.findOrCreate({
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
    accountFollow.AccountFollower = account
    accountFollow.AccountFollowing = targetAccount

    // Target sends to account he accepted the follow request
    return sendAccept(accountFollow, t)
  })

  logger.info('Account uuid %s is followed by account %s.', account.url, targetAccountURL)
}
