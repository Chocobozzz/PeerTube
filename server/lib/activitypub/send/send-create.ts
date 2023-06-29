import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application'
import {
  ActivityAudience,
  ActivityCreate,
  ActivityCreateObject,
  ContextType,
  VideoCommentObject,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { VideoCommentModel } from '../../../models/video/video-comment'
import {
  MActorLight,
  MCommentOwnerVideo,
  MLocalVideoViewerWithWatchSections,
  MVideoAccountLight,
  MVideoAP,
  MVideoPlaylistFull,
  MVideoRedundancyFileVideo,
  MVideoRedundancyStreamingPlaylistVideo
} from '../../../types/models'
import { audiencify, getAudience } from '../audience'
import {
  broadcastToActors,
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudienceFromFollowersOf,
  getVideoCommentAudience,
  sendVideoActivityToOrigin,
  sendVideoRelatedActivity,
  unicastTo
} from './shared'

const lTags = loggerTagsFactory('ap', 'create')

async function sendCreateVideo (video: MVideoAP, transaction: Transaction) {
  if (!video.hasPrivacyForFederation()) return undefined

  logger.info('Creating job to send video creation of %s.', video.url, lTags(video.uuid))

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = await video.toActivityPubObject()

  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)
  const createActivity = buildCreateActivity(video.url, byActor, videoObject, audience)

  return broadcastToFollowers({
    data: createActivity,
    byActor,
    toFollowersOf: [ byActor ],
    transaction,
    contextType: 'Video'
  })
}

async function sendCreateCacheFile (
  byActor: MActorLight,
  video: MVideoAccountLight,
  fileRedundancy: MVideoRedundancyStreamingPlaylistVideo | MVideoRedundancyFileVideo
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

async function sendCreateWatchAction (stats: MLocalVideoViewerWithWatchSections, transaction: Transaction) {
  logger.info('Creating job to send create watch action %s.', stats.url, lTags(stats.uuid))

  const byActor = await getServerActor()

  const activityBuilder = (audience: ActivityAudience) => {
    return buildCreateActivity(stats.url, byActor, stats.toActivityPubObject(), audience)
  }

  return sendVideoActivityToOrigin(activityBuilder, { byActor, video: stats.Video, transaction, contextType: 'WatchAction' })
}

async function sendCreateVideoPlaylist (playlist: MVideoPlaylistFull, transaction: Transaction) {
  if (playlist.privacy === VideoPlaylistPrivacy.PRIVATE) return undefined

  logger.info('Creating job to send create video playlist of %s.', playlist.url, lTags(playlist.uuid))

  const byActor = playlist.OwnerAccount.Actor
  const audience = getAudience(byActor, playlist.privacy === VideoPlaylistPrivacy.PUBLIC)

  const object = await playlist.toActivityPubObject(null, transaction)
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

async function sendCreateVideoComment (comment: MCommentOwnerVideo, transaction: Transaction) {
  logger.info('Creating job to send comment %s.', comment.url)

  const isOrigin = comment.Video.isOwned()

  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, transaction)
  const commentObject = comment.toActivityPubObject(threadParentComments) as VideoCommentObject

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, transaction)
  // Add the actor that commented too
  actorsInvolvedInComment.push(byActor)

  const parentsCommentActors = threadParentComments.filter(c => !c.isDeleted())
                                                   .map(c => c.Account.Actor)

  let audience: ActivityAudience
  if (isOrigin) {
    audience = getVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment, isOrigin)
  } else {
    audience = getAudienceFromFollowersOf(actorsInvolvedInComment.concat(parentsCommentActors))
  }

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
  if (isOrigin) {
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
      toActorUrl: comment.Video.VideoChannel.Account.Actor.getSharedInbox(),
      contextType: 'Comment'
    })
  })
}

function buildCreateActivity <T extends ActivityCreateObject> (
  url: string,
  byActor: MActorLight,
  object: T,
  audience?: ActivityAudience
): ActivityCreate<T> {
  if (!audience) audience = getAudience(byActor)

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

export {
  sendCreateVideo,
  buildCreateActivity,
  sendCreateVideoComment,
  sendCreateVideoPlaylist,
  sendCreateCacheFile,
  sendCreateWatchAction
}

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
