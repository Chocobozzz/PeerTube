import { WEBSERVER } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { VideoAbuseModel } from '../../models/video/video-abuse'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { ActorModelOnly, ActorModelUrl } from '../../typings/models'
import { ActorFollowModelLight } from '../../typings/models/actor-follow'

function getVideoActivityPubUrl (video: VideoModel) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid
}

function getVideoPlaylistActivityPubUrl (videoPlaylist: VideoPlaylistModel) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid
}

function getVideoPlaylistElementActivityPubUrl (videoPlaylist: VideoPlaylistModel, video: VideoModel) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid + '/' + video.uuid
}

function getVideoCacheFileActivityPubUrl (videoFile: VideoFileModel) {
  const suffixFPS = videoFile.fps && videoFile.fps !== -1 ? '-' + videoFile.fps : ''

  return `${WEBSERVER.URL}/redundancy/videos/${videoFile.Video.uuid}/${videoFile.resolution}${suffixFPS}`
}

function getVideoCacheStreamingPlaylistActivityPubUrl (video: VideoModel, playlist: VideoStreamingPlaylistModel) {
  return `${WEBSERVER.URL}/redundancy/streaming-playlists/${playlist.getStringType()}/${video.uuid}`
}

function getVideoCommentActivityPubUrl (video: VideoModel, videoComment: VideoCommentModel) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id
}

function getVideoChannelActivityPubUrl (videoChannelName: string) {
  return WEBSERVER.URL + '/video-channels/' + videoChannelName
}

function getAccountActivityPubUrl (accountName: string) {
  return WEBSERVER.URL + '/accounts/' + accountName
}

function getVideoAbuseActivityPubUrl (videoAbuse: VideoAbuseModel) {
  return WEBSERVER.URL + '/admin/video-abuses/' + videoAbuse.id
}

function getVideoViewActivityPubUrl (byActor: ActorModelUrl, video: VideoModel) {
  return byActor.url + '/views/videos/' + video.id + '/' + new Date().toISOString()
}

function getVideoLikeActivityPubUrl (byActor: ActorModelUrl, video: VideoModel | { id: number }) {
  return byActor.url + '/likes/' + video.id
}

function getVideoDislikeActivityPubUrl (byActor: ActorModelUrl, video: VideoModel | { id: number }) {
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

function getActorFollowActivityPubUrl (follower: ActorModelOnly, following: ActorModelOnly) {
  return follower.url + '/follows/' + following.id
}

function getActorFollowAcceptActivityPubUrl (actorFollow: ActorFollowModelLight) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  return follower.url + '/accepts/follows/' + me.id
}

function getActorFollowRejectActivityPubUrl (follower: ActorModelOnly, following: ActorModelOnly) {
  return follower.url + '/rejects/follows/' + following.id
}

function getVideoAnnounceActivityPubUrl (byActor: ActorModelOnly, video: VideoModel) {
  return video.url + '/announces/' + byActor.id
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
  getVideoPlaylistElementActivityPubUrl,
  getVideoPlaylistActivityPubUrl,
  getVideoCacheStreamingPlaylistActivityPubUrl,
  getVideoChannelActivityPubUrl,
  getAccountActivityPubUrl,
  getVideoAbuseActivityPubUrl,
  getActorFollowActivityPubUrl,
  getActorFollowAcceptActivityPubUrl,
  getVideoAnnounceActivityPubUrl,
  getUpdateActivityPubUrl,
  getUndoActivityPubUrl,
  getVideoViewActivityPubUrl,
  getVideoLikeActivityPubUrl,
  getVideoDislikeActivityPubUrl,
  getActorFollowRejectActivityPubUrl,
  getVideoCommentActivityPubUrl,
  getDeleteActivityPubUrl,
  getVideoSharesActivityPubUrl,
  getVideoCommentsActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoCacheFileActivityPubUrl
}
