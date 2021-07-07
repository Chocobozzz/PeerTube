import { WEBSERVER } from '../../initializers/constants'
import {
  MAbuseId,
  MActor,
  MActorFollowActors,
  MActorId,
  MActorUrl,
  MCommentId,
  MVideoId,
  MVideoPlaylistElement,
  MVideoUrl,
  MVideoUUID
} from '../../types/models'
import { MVideoFileVideoUUID } from '../../types/models/video/video-file'
import { MVideoPlaylist, MVideoPlaylistUUID } from '../../types/models/video/video-playlist'
import { MStreamingPlaylist } from '../../types/models/video/video-streaming-playlist'

function getLocalVideoActivityPubUrl (video: MVideoUUID) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid
}

function getLocalVideoPlaylistActivityPubUrl (videoPlaylist: MVideoPlaylist) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid
}

function getLocalVideoPlaylistElementActivityPubUrl (videoPlaylist: MVideoPlaylistUUID, videoPlaylistElement: MVideoPlaylistElement) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid + '/videos/' + videoPlaylistElement.id
}

function getLocalVideoCacheFileActivityPubUrl (videoFile: MVideoFileVideoUUID) {
  const suffixFPS = videoFile.fps && videoFile.fps !== -1 ? '-' + videoFile.fps : ''

  return `${WEBSERVER.URL}/redundancy/videos/${videoFile.Video.uuid}/${videoFile.resolution}${suffixFPS}`
}

function getLocalVideoCacheStreamingPlaylistActivityPubUrl (video: MVideoUUID, playlist: MStreamingPlaylist) {
  return `${WEBSERVER.URL}/redundancy/streaming-playlists/${playlist.getStringType()}/${video.uuid}`
}

function getLocalVideoCommentActivityPubUrl (video: MVideoUUID, videoComment: MCommentId) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id
}

function getLocalVideoChannelActivityPubUrl (videoChannelName: string) {
  return WEBSERVER.URL + '/video-channels/' + videoChannelName
}

function getLocalAccountActivityPubUrl (accountName: string) {
  return WEBSERVER.URL + '/accounts/' + accountName
}

function getLocalAbuseActivityPubUrl (abuse: MAbuseId) {
  return WEBSERVER.URL + '/admin/abuses/' + abuse.id
}

function getLocalVideoViewActivityPubUrl (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/views/videos/' + video.id + '/' + new Date().toISOString()
}

function getVideoLikeActivityPubUrlByLocalActor (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/likes/' + video.id
}

function getVideoDislikeActivityPubUrlByLocalActor (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/dislikes/' + video.id
}

function getLocalVideoSharesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/announces'
}

function getLocalVideoCommentsActivityPubUrl (video: MVideoUrl) {
  return video.url + '/comments'
}

function getLocalVideoLikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/likes'
}

function getLocalVideoDislikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/dislikes'
}

function getLocalActorFollowActivityPubUrl (follower: MActor, following: MActorId) {
  return follower.url + '/follows/' + following.id
}

function getLocalActorFollowAcceptActivityPubUrl (actorFollow: MActorFollowActors) {
  const follower = actorFollow.ActorFollower
  const me = actorFollow.ActorFollowing

  return WEBSERVER.URL + '/accepts/follows/' + follower.id + '/' + me.id
}

function getLocalActorFollowRejectActivityPubUrl (follower: MActorId, following: MActorId) {
  return WEBSERVER.URL + '/rejects/follows/' + follower.id + '/' + following.id
}

function getLocalVideoAnnounceActivityPubUrl (byActor: MActorId, video: MVideoUrl) {
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
  getLocalVideoActivityPubUrl,
  getLocalVideoPlaylistActivityPubUrl,
  getLocalVideoPlaylistElementActivityPubUrl,
  getLocalVideoCacheFileActivityPubUrl,
  getLocalVideoCacheStreamingPlaylistActivityPubUrl,
  getLocalVideoCommentActivityPubUrl,
  getLocalVideoChannelActivityPubUrl,
  getLocalAccountActivityPubUrl,
  getLocalAbuseActivityPubUrl,
  getLocalActorFollowActivityPubUrl,
  getLocalActorFollowAcceptActivityPubUrl,
  getLocalVideoAnnounceActivityPubUrl,
  getUpdateActivityPubUrl,
  getUndoActivityPubUrl,
  getVideoLikeActivityPubUrlByLocalActor,
  getLocalVideoViewActivityPubUrl,
  getVideoDislikeActivityPubUrlByLocalActor,
  getLocalActorFollowRejectActivityPubUrl,
  getDeleteActivityPubUrl,
  getLocalVideoSharesActivityPubUrl,
  getLocalVideoCommentsActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl
}
