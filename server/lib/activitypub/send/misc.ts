import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger'
import { ACTIVITY_PUB, database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { activitypubHttpJobScheduler } from '../../jobs/activitypub-http-job-scheduler/activitypub-http-job-scheduler'
import { VideoInstance } from '../../../models/video/video-interface'

async function broadcastToFollowers (
  data: any,
  byAccount: AccountInstance,
  toAccountFollowers: AccountInstance[],
  t: Transaction,
  followersException: AccountInstance[] = []
) {
  const toAccountFollowerIds = toAccountFollowers.map(a => a.id)

  const result = await db.AccountFollow.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds)
  if (result.data.length === 0) {
    logger.info('Not broadcast because of 0 followers for %s.', toAccountFollowerIds.join(', '))
    return undefined
  }

  const followersSharedInboxException = followersException.map(f => f.sharedInboxUrl)
  const uris = result.data.filter(sharedInbox => followersSharedInboxException.indexOf(sharedInbox) === -1)

  const jobPayload = {
    uris,
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

function getOriginVideoAudience (video: VideoInstance) {
  return {
    to: [ video.VideoChannel.Account.url ],
    cc: [ video.VideoChannel.Account.url + '/followers' ]
  }
}

function getVideoFollowersAudience (video: VideoInstance) {
  return {
    to: [ video.VideoChannel.Account.url + '/followers' ],
    cc: []
  }
}

async function getAccountsToForwardVideoAction (byAccount: AccountInstance, video: VideoInstance) {
  const accountsToForwardView = await db.VideoShare.loadAccountsByShare(video.id)
  accountsToForwardView.push(video.VideoChannel.Account)

  return accountsToForwardView
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
  getAudience,
  getOriginVideoAudience,
  getAccountsToForwardVideoAction,
  getVideoFollowersAudience
}
