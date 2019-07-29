import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { broadcastToActors, broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience, getAudienceFromFollowersOf, getVideoCommentAudience } from '../audience'
import { logger } from '../../../helpers/logger'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { getServerActor } from '../../../helpers/utils'
import * as Bluebird from 'bluebird'

async function sendCreateVideo (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  logger.info('Creating job to send video creation of %s.', video.url)

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = video.toActivityPubObject()

  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)
  const createActivity = buildCreateActivity(video.url, byActor, videoObject, audience)

  return broadcastToFollowers(createActivity, byActor, [ byActor ], t)
}

async function sendCreateCacheFile (byActor: ActorModel, video: VideoModel, fileRedundancy: VideoRedundancyModel) {
  logger.info('Creating job to send file cache of %s.', fileRedundancy.url)

  return sendVideoRelatedCreateActivity({
    byActor,
    video,
    url: fileRedundancy.url,
    object: fileRedundancy.toActivityPubObject()
  })
}

async function sendCreateVideoPlaylist (playlist: VideoPlaylistModel, t: Transaction) {
  if (playlist.privacy === VideoPlaylistPrivacy.PRIVATE) return undefined

  logger.info('Creating job to send create video playlist of %s.', playlist.url)

  const byActor = playlist.OwnerAccount.Actor
  const audience = getAudience(byActor, playlist.privacy === VideoPlaylistPrivacy.PUBLIC)

  const object = await playlist.toActivityPubObject(null, t)
  const createActivity = buildCreateActivity(playlist.url, byActor, object, audience)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (playlist.VideoChannel) toFollowersOf.push(playlist.VideoChannel.Actor)

  return broadcastToFollowers(createActivity, byActor, toFollowersOf, t)
}

async function sendCreateVideoComment (comment: VideoCommentModel, t: Transaction) {
  logger.info('Creating job to send comment %s.', comment.url)

  const isOrigin = comment.Video.isOwned()

  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, t)
  const commentObject = comment.toActivityPubObject(threadParentComments)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, t)
  // Add the actor that commented too
  actorsInvolvedInComment.push(byActor)

  const parentsCommentActors = threadParentComments.map(c => c.Account.Actor)

  let audience: ActivityAudience
  if (isOrigin) {
    audience = getVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment, isOrigin)
  } else {
    audience = getAudienceFromFollowersOf(actorsInvolvedInComment.concat(parentsCommentActors))
  }

  const createActivity = buildCreateActivity(comment.url, byActor, commentObject, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(createActivity, byActor, parentsCommentActors, t, actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(createActivity, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  if (isOrigin) return broadcastToFollowers(createActivity, byActor, actorsInvolvedInComment, t, actorsException)

  // Send to origin
  t.afterCommit(() => unicastTo(createActivity, byActor, comment.Video.VideoChannel.Account.Actor.sharedInboxUrl))
}

function buildCreateActivity (url: string, byActor: ActorModel, object: any, audience?: ActivityAudience): ActivityCreate {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Create' as 'Create',
      id: url + '/activity',
      actor: byActor.url,
      object: audiencify(object, audience)
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
  sendCreateCacheFile
}

// ---------------------------------------------------------------------------

async function sendVideoRelatedCreateActivity (options: {
  byActor: ActorModel,
  video: VideoModel,
  url: string,
  object: any,
  transaction?: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    return buildCreateActivity(options.url, options.byActor, options.object, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}
