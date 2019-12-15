import { WEBSERVER } from '../../initializers/constants'
import {
  MActor,
  MActorFollowActors,
  MActorId,
  MActorUrl,
  MCommentId,
  MVideoAbuseId,
  MVideoId,
  MVideoUrl,
  MVideoUUID
} from '../../typings/models'
import { MVideoPlaylist, MVideoPlaylistUUID } from '../../typings/models/video/video-playlist'
import { MVideoFileVideoUUID } from '../../typings/models/video/video-file'
import { MStreamingPlaylist } from '../../typings/models/video/video-streaming-playlist'

function getVideoActivityPubUrl (video: MVideoUUID) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid
}

function getVideoPlaylistActivityPubUrl (videoPlaylist: MVideoPlaylist) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid
}

function getVideoPlaylistElementActivityPubUrl (videoPlaylist: MVideoPlaylistUUID, video: MVideoUUID) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid + '/' + video.uuid
}

function getVideoCacheFileActivityPubUrl (videoFile: MVideoFileVideoUUID) {
  const suffixFPS = videoFile.fps && videoFile.fps !== -1 ? '-' + videoFile.fps : ''

  return `${WEBSERVER.URL}/redundancy/videos/${videoFile.Video.uuid}/${videoFile.resolution}${suffixFPS}`
}

function getVideoCacheStreamingPlaylistActivityPubUrl (video: MVideoUUID, playlist: MStreamingPlaylist) {
  return `${WEBSERVER.URL}/redundancy/streaming-playlists/${playlist.getStringType()}/${video.uuid}`
}

function getVideoCommentActivityPubUrl (video: MVideoUUID, videoComment: MCommentId) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id
}

function getVideoChannelActivityPubUrl (videoChannelName: string) {
  return WEBSERVER.URL + '/video-channels/' + videoChannelName
}

function getAccountActivityPubUrl (accountName: string) {
  return WEBSERVER.URL + '/accounts/' + accountName
}

function getVideoAbuseActivityPubUrl (videoAbuse: MVideoAbuseId) {
  return WEBSERVER.URL + '/admin/video-abuses/' + videoAbuse.id
}

function getVideoViewActivityPubUrl (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/views/videos/' + video.id + '/' + new Date().toISOString()
}

function getVideoLikeActivityPubUrl (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/likes/' + video.id
}

function getVideoDislikeActivityPubUrl (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/dislikes/' + video.id
}

function getVideoSharesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/announces'
}

function getVideoCommentsActivityPubUrl (video: MVideoUrl) {
  return video.url + '/comments'
}

function getVideoLikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/likes'
}

function getVideoDislikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/dislikes'
}

function getActorFollowActivityPubUrl (follower: MActor, following: MActorId) {
  return follower.url + '/follows/' + following.id
}

function getActorFollowAcceptActivityPubUrl (actorFollow: MActorFollowActors) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  return follower.url + '/accepts/follows/' + me.id
}

function getActorFollowRejectActivityPubUrl (follower: MActorUrl, following: MActorId) {
  return follower.url + '/rejects/follows/' + following.id
}

function getVideoAnnounceActivityPubUrl (byActor: MActorId, video: MVideoUrl) {
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
