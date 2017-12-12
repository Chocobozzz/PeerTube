import { Transaction } from 'sequelize'
import { Activity } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers'
import { ACTIVITY_PUB } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoChannelShareModel } from '../../../models/video/video-channel-share'
import { VideoShareModel } from '../../../models/video/video-share'
import { activitypubHttpJobScheduler, ActivityPubHttpPayload } from '../../jobs/activitypub-http-job-scheduler'

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: AccountModel[] = []
) {
  const to = activity.to || []
  const cc = activity.cc || []

  const followersUrls: string[] = []
  for (const dest of to.concat(cc)) {
    if (dest.endsWith('/followers')) {
      followersUrls.push(dest)
    }
  }

  const toAccountFollowers = await AccountModel.listByFollowersUrls(followersUrls, t)
  const uris = await computeFollowerUris(toAccountFollowers, followersException, t)

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
  byAccount: AccountModel,
  toAccountFollowers: AccountModel[],
  t: Transaction,
  followersException: AccountModel[] = []
) {
  const uris = await computeFollowerUris(toAccountFollowers, followersException, t)
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

async function unicastTo (data: any, byAccount: AccountModel, toAccountUrl: string, t: Transaction) {
  logger.debug('Creating unicast job.', { uri: toAccountUrl })

  const jobPayload: ActivityPubHttpPayload = {
    uris: [ toAccountUrl ],
    signatureAccountId: byAccount.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpUnicastHandler', jobPayload)
}

function getOriginVideoAudience (video: VideoModel, accountsInvolvedInVideo: AccountModel[]) {
  return {
    to: [ video.VideoChannel.Account.url ],
    cc: accountsInvolvedInVideo.map(a => a.followersUrl)
  }
}

function getOriginVideoChannelAudience (videoChannel: VideoChannelModel, accountsInvolved: AccountModel[]) {
  return {
    to: [ videoChannel.Account.url ],
    cc: accountsInvolved.map(a => a.followersUrl)
  }
}

function getObjectFollowersAudience (accountsInvolvedInObject: AccountModel[]) {
  return {
    to: accountsInvolvedInObject.map(a => a.followersUrl),
    cc: []
  }
}

async function getAccountsInvolvedInVideo (video: VideoModel, t: Transaction) {
  const accountsToForwardView = await VideoShareModel.loadAccountsByShare(video.id, t)
  accountsToForwardView.push(video.VideoChannel.Account)

  return accountsToForwardView
}

async function getAccountsInvolvedInVideoChannel (videoChannel: VideoChannelModel, t: Transaction) {
  const accountsToForwardView = await VideoChannelShareModel.loadAccountsByShare(videoChannel.id, t)
  accountsToForwardView.push(videoChannel.Account)

  return accountsToForwardView
}

async function getAudience (accountSender: AccountModel, t: Transaction, isPublic = true) {
  const followerInboxUrls = await accountSender.getFollowerSharedInboxUrls(t)

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

async function computeFollowerUris (toAccountFollower: AccountModel[], followersException: AccountModel[], t: Transaction) {
  const toAccountFollowerIds = toAccountFollower.map(a => a.id)

  const result = await AccountFollowModel.listAcceptedFollowerSharedInboxUrls(toAccountFollowerIds, t)
  const followersSharedInboxException = followersException.map(f => f.sharedInboxUrl)
  return result.data.filter(sharedInbox => followersSharedInboxException.indexOf(sharedInbox) === -1)
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  getOriginVideoChannelAudience,
  unicastTo,
  getAudience,
  getOriginVideoAudience,
  getAccountsInvolvedInVideo,
  getAccountsInvolvedInVideoChannel,
  getObjectFollowersAudience,
  forwardActivity
}
