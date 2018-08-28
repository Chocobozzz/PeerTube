import { CONFIG } from '../../initializers'
import { ActorModel } from '../../models/activitypub/actor'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { VideoModel } from '../../models/video/video'
import { VideoAbuseModel } from '../../models/video/video-abuse'
import { VideoCommentModel } from '../../models/video/video-comment'

function getVideoActivityPubUrl (video: VideoModel) {
  return CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid
}

function getVideoCommentActivityPubUrl (video: VideoModel, videoComment: VideoCommentModel) {
  return CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id
}

function getVideoChannelActivityPubUrl (videoChannelName: string) {
  return CONFIG.WEBSERVER.URL + '/video-channels/' + videoChannelName
}

function getAccountActivityPubUrl (accountName: string) {
  return CONFIG.WEBSERVER.URL + '/accounts/' + accountName
}

function getVideoAbuseActivityPubUrl (videoAbuse: VideoAbuseModel) {
  return CONFIG.WEBSERVER.URL + '/admin/video-abuses/' + videoAbuse.id
}

function getVideoViewActivityPubUrl (byActor: ActorModel, video: VideoModel) {
  return video.url + '/views/' + byActor.uuid + '/' + new Date().toISOString()
}

function getVideoLikeActivityPubUrl (byActor: ActorModel, video: VideoModel) {
  return byActor.url + '/likes/' + video.id
}

function getVideoDislikeActivityPubUrl (byActor: ActorModel, video: VideoModel) {
  return byActor.url + '/dislikes/' + video.id
}

function getVideoSharesActivityPubUrl (video: VideoModel) {
  return video.url + '/announces'
}

function getVideoCommentsActivityPubUrl (video: VideoModel) {
  return video.url + '/comments'
}

function getVideoLikesActivityPubUrl (video: VideoModel) {
  return video.url + '/likes'
}

function getVideoDislikesActivityPubUrl (video: VideoModel) {
  return video.url + '/dislikes'
}

function getActorFollowActivityPubUrl (actorFollow: ActorFollowModel) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  return me.url + '/follows/' + following.id
}

function getActorFollowAcceptActivityPubUrl (actorFollow: ActorFollowModel) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  return follower.url + '/accepts/follows/' + me.id
}

function getAnnounceActivityPubUrl (originalUrl: string, byActor: ActorModel) {
  return originalUrl + '/announces/' + byActor.id
}

function getDeleteActivityPubUrl (originalUrl: string) {
  return originalUrl + '/delete'
}

function getUpdateActivityPubUrl (originalUrl: string, updatedAt: string) {
  return originalUrl + '/updates/' + updatedAt
}

function getUndoActivityPubUrl (originalUrl: string) {
  return originalUrl + '/undo'
}

export {
  getVideoActivityPubUrl,
  getVideoChannelActivityPubUrl,
  getAccountActivityPubUrl,
  getVideoAbuseActivityPubUrl,
  getActorFollowActivityPubUrl,
  getActorFollowAcceptActivityPubUrl,
  getAnnounceActivityPubUrl,
  getUpdateActivityPubUrl,
  getUndoActivityPubUrl,
  getVideoViewActivityPubUrl,
  getVideoLikeActivityPubUrl,
  getVideoDislikeActivityPubUrl,
  getVideoCommentActivityPubUrl,
  getDeleteActivityPubUrl,
  getVideoSharesActivityPubUrl,
  getVideoCommentsActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoDislikesActivityPubUrl
}
