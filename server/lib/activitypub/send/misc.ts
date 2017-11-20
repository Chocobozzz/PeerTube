import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger'
import { ACTIVITY_PUB, database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { activitypubHttpJobScheduler } from '../../jobs/activitypub-http-job-scheduler/activitypub-http-job-scheduler'

async function broadcastToFollowers (data: any, byAccount: AccountInstance, toAccountFollowers: AccountInstance[], t: Transaction) {
  const toAccountFollowerIds = toAccountFollowers.map(a => a.id)
  const result = await db.AccountFollow.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds)
  if (result.data.length === 0) {
    logger.info('Not broadcast because of 0 followers for %s.', toAccountFollowerIds.join(', '))
    return undefined
  }

  const jobPayload = {
    uris: result.data,
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, byAccount: AccountInstance, toAccountUrl: string, t: Transaction) {
  const jobPayload = {
    uris: [ toAccountUrl ],
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpUnicastHandler', jobPayload)
}

async function getAudience (accountSender: AccountInstance, isPublic = true) {
  const followerInboxUrls = await accountSender.getFollowerSharedInboxUrls()

  // Thanks Mastodon: https://github.com/tootsuite/mastodon/blob/master/app/lib/activitypub/tag_manager.rb#L47
  let to = []
  let cc = []

  if (isPublic) {
    to = [ ACTIVITY_PUB.PUBLIC ]
    cc = followerInboxUrls
  } else { // Unlisted
    to = followerInboxUrls
    cc = [ ACTIVITY_PUB.PUBLIC ]
  }

  return { to, cc }
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  getAudience
}
