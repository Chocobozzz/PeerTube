import {
  ActivityAudience,
  ActivityCreate,
  ActivityCreateObject,
  ContextType,
  VideoCommentObject,
  VideoPlaylistPrivacy
} from '@peertube/peertube-models'
import { AccountModel } from '@server/models/account/account.js'
import { getServerActor } from '@server/models/application/application.js'
import { VideoModel } from '@server/models/video/video.js'
import { Transaction } from 'sequelize'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import {
  MActorLight,
  MCommentOwnerVideoReply,
  MLocalVideoViewerWithWatchSections,
  MVideoAP,
  MVideoAccountLight,
  MVideoPlaylistFull,
  MVideoRedundancyStreamingPlaylistVideo
} from '../../../types/models/index.js'
import { audiencify, getCommentAudience, getPlaylistAudience, getPublicAudience, getVideoAudience } from '../audience.js'
import { canVideoBeFederated } from '../videos/federate.js'
import {
  broadcastToActors,
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  sendVideoRelatedActivity,
  sendVideoRelatedActivityToOrigin,
  unicastTo
} from './shared/send-utils.js'

const lTags = loggerTagsFactory('ap', 'create')

export async function sendCreateVideo (video: MVideoAP, transaction: Transaction) {
  if (!canVideoBeFederated(video)) return undefined

  logger.info('Creating job to send video creation of %s.', video.url, lTags(video.uuid))

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = await video.toActivityPubObject()

  const audience = getVideoAudience({ account: video.VideoChannel.Account, channel: video.VideoChannel, privacy: video.privacy })
  const createActivity = buildCreateActivity(video.url, byActor, videoObject, audience)

  return broadcastToFollowers({
    data: createActivity,
    byActor,
    toFollowersOf: [ byActor ],
    transaction,
    contextType: 'Video'
  })
}

export async function sendCreateCacheFile (
  byActor: MActorLight,
  video: MVideoAccountLight,
  fileRedundancy: MVideoRedundancyStreamingPlaylistVideo
) {
  logger.info('Creating job to send file cache of %s.', fileRedundancy.url, lTags(video.uuid))

  return sendVideoRelatedCreateActivity({
    byActor,
    video,
    url: fileRedundancy.url,
    object: fileRedundancy.toActivityPubObject(),
    contextType: 'CacheFile'
  })
}

export async function sendCreateWatchAction (stats: MLocalVideoViewerWithWatchSections, transaction: Transaction) {
  logger.info('Creating job to send create watch action %s.', stats.url, lTags(stats.uuid))

  const byActor = await getServerActor()

  const activityBuilder = (audience: ActivityAudience) => {
    return buildCreateActivity(stats.url, byActor, stats.toActivityPubObject(), audience)
  }

  return sendVideoRelatedActivityToOrigin(activityBuilder, { byActor, video: stats.Video, transaction, contextType: 'WatchAction' })
}

export async function sendCreateVideoPlaylist (playlist: MVideoPlaylistFull, transaction: Transaction) {
  if (playlist.privacy === VideoPlaylistPrivacy.PRIVATE) return undefined

  logger.info('Creating job to send create video playlist of %s.', playlist.url, lTags(playlist.uuid))

  const audience = getPlaylistAudience({ account: playlist.OwnerAccount, channel: playlist.VideoChannel, privacy: playlist.privacy })

  const object = await playlist.toActivityPubObject(null, transaction)

  const byActor = playlist.OwnerAccount.Actor
  const createActivity = buildCreateActivity(playlist.url, byActor, object, audience)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (playlist.VideoChannel) toFollowersOf.push(playlist.VideoChannel.Actor)

  return broadcastToFollowers({
    data: createActivity,
    byActor,
    toFollowersOf,
    transaction,
    contextType: 'Playlist'
  })
}

export async function sendCreateVideoCommentIfNeeded (comment: MCommentOwnerVideoReply, transaction: Transaction) {
  if (comment.Video.isLocal()) {
    const videoWithBlacklist = await VideoModel.loadWithBlacklist(comment.Video.id)

    if (!canVideoBeFederated(videoWithBlacklist)) {
      logger.debug(`Do not send comment ${comment.url} on a video that cannot be federated`)
      return undefined
    }

    if (comment.heldForReview) {
      logger.debug(`Do not send comment ${comment.url} that requires approval`)
      return undefined
    }
  }

  logger.info('Creating job to send comment %s.', comment.url)

  const byActor = comment.Account.Actor
  const videoAccount = await AccountModel.load(comment.Video.VideoChannel.Account.id, transaction)

  const threadParentComments = await VideoCommentModel.listThreadParentComments({ comment, transaction })
  const commentObject = comment.toActivityPubObject(threadParentComments) as VideoCommentObject

  const parentsCommentActors = threadParentComments.filter(c => !c.isDeleted() && !c.heldForReview)
    .map(c => c.Account.Actor)

  const video = await VideoModel.loadByUrlAndPopulateAccount(comment.Video.url, transaction)
  const audience = getCommentAudience({ comment, video, threadParentComments })

  const createActivity = buildCreateActivity(comment.url, byActor, commentObject, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors({
    data: createActivity,
    byActor,
    toActors: parentsCommentActors,
    transaction,
    actorsException,
    contextType: 'Comment'
  })

  // Broadcast to our followers
  await broadcastToFollowers({
    data: createActivity,
    byActor,
    toFollowersOf: [ byActor ],
    transaction,
    contextType: 'Comment'
  })

  // Send to actors involved in the comment
  if (comment.Video.isLocal()) {
    const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, transaction)
    // Add the actor that commented too
    actorsInvolvedInComment.push(byActor)

    return broadcastToFollowers({
      data: createActivity,
      byActor,
      toFollowersOf: actorsInvolvedInComment,
      transaction,
      actorsException,
      contextType: 'Comment'
    })
  }

  // Send to origin
  return transaction.afterCommit(() => {
    return unicastTo({
      data: createActivity,
      byActor,
      toActorUrl: videoAccount.Actor.getSharedInbox(),
      contextType: 'Comment'
    })
  })
}

export function buildCreateActivity<T extends ActivityCreateObject> (
  url: string,
  byActor: MActorLight,
  object: T,
  audience?: ActivityAudience
): ActivityCreate<T> {
  if (!audience) audience = getPublicAudience(byActor)

  return audiencify(
    {
      type: 'Create' as 'Create',
      id: url + '/activity',
      actor: byActor.url,
      object: typeof object === 'string'
        ? object
        : audiencify(object, audience)
    },
    audience
  )
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function sendVideoRelatedCreateActivity (options: {
  byActor: MActorLight
  video: MVideoAccountLight
  url: string
  object: any
  contextType: ContextType
  transaction?: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    return buildCreateActivity(options.url, options.byActor, options.object, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}
