import { ActivityFollow } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'
import { getOrCreateAccountAndServer } from '../account'
import { sendAccept } from '../send'

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

function processFollow (account: AccountModel, targetAccountURL: string) {
  const options = {
    arguments: [ account, targetAccountURL ],
    errorMessage: 'Cannot follow with many retries.'
  }

  return retryTransactionWrapper(follow, options)
}

async function follow (account: AccountModel, targetAccountURL: string) {
  await sequelizeTypescript.transaction(async t => {
    const targetAccount = await AccountModel.loadByUrl(targetAccountURL, t)

    if (!targetAccount) throw new Error('Unknown account')
    if (targetAccount.isOwned() === false) throw new Error('This is not a local account.')

    const [ accountFollow ] = await AccountFollowModel.findOrCreate({
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

    if (accountFollow.state !== 'accepted') {
      accountFollow.state = 'accepted'
      await accountFollow.save({ transaction: t })
    }

    accountFollow.AccountFollower = account
    accountFollow.AccountFollowing = targetAccount

    // Target sends to account he accepted the follow request
    return sendAccept(accountFollow, t)
  })

  logger.info('Account uuid %s is followed by account %s.', account.url, targetAccountURL)
}
