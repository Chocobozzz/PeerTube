import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger'
import { ACTIVITY_PUB, database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import {
  activitypubHttpJobScheduler,
  ActivityPubHttpPayload
} from '../../jobs/activitypub-http-job-scheduler/activitypub-http-job-scheduler'
import { VideoInstance } from '../../../models/video/video-interface'
import { Activity } from '../../../../shared/models/activitypub/activity'

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: AccountInstance[] = []
) {
  const to = activity.to || []
  const cc = activity.cc || []

  const followersUrls: string[] = []
  for (const dest of to.concat(cc)) {
    if (dest.endsWith('/followers')) {
      followersUrls.push(dest)
    }
  }

  const toAccountFollowers = await db.Account.listByFollowersUrls(followersUrls)
  const uris = await computeFollowerUris(toAccountFollowers, followersException)

  if (uris.length === 0) {
    logger.info('0 followers for %s, no forwarding.', toAccountFollowers.map(a => a.id).join(', '))
    return undefined
  }

  logger.debug('Creating forwarding job.', { uris })

  const jobPayload: ActivityPubHttpPayload = {
    uris,
    body: activity
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function broadcastToFollowers (
  data: any,
  byAccount: AccountInstance,
  toAccountFollowers: AccountInstance[],
  t: Transaction,
  followersException: AccountInstance[] = []
) {
  const uris = await computeFollowerUris(toAccountFollowers, followersException)
  if (uris.length === 0) {
    logger.info('0 followers for %s, no broadcasting.', toAccountFollowers.map(a => a.id).join(', '))
    return undefined
  }

  logger.debug('Creating broadcast job.', { uris })

  const jobPayload: ActivityPubHttpPayload = {
    uris,
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, byAccount: AccountInstance, toAccountUrl: string, t: Transaction) {
  logger.debug('Creating unicast job.', { uri: toAccountUrl })

  const jobPayload: ActivityPubHttpPayload = {
    uris: [ toAccountUrl ],
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpUnicastHandler', jobPayload)
}

function getOriginVideoAudience (video: VideoInstance, accountsInvolvedInVideo: AccountInstance[]) {
  return {
    to: [ video.VideoChannel.Account.url ],
    cc: accountsInvolvedInVideo.map(a => a.followersUrl)
  }
}

function getVideoFollowersAudience (accountsInvolvedInVideo: AccountInstance[]) {
  return {
    to: accountsInvolvedInVideo.map(a => a.followersUrl),
    cc: []
  }
}

async function getAccountsInvolvedInVideo (video: VideoInstance) {
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

async function computeFollowerUris (toAccountFollower: AccountInstance[], followersException: AccountInstance[]) {
  const toAccountFollowerIds = toAccountFollower.map(a => a.id)

  const result = await db.AccountFollow.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds)
  const followersSharedInboxException = followersException.map(f => f.sharedInboxUrl)
  const uris = result.data.filter(sharedInbox => followersSharedInboxException.indexOf(sharedInbox) === -1)

  return uris
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  getAudience,
  getOriginVideoAudience,
  getAccountsInvolvedInVideo,
  getVideoFollowersAudience,
  forwardActivity
}
