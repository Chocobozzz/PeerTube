import { REMOTE_SCHEME, WEBSERVER } from '../../initializers/constants.js'
import {
  MAbuseFull,
  MAbuseId,
  MActor,
  MActorFollow,
  MActorId,
  MActorUrl,
  MCommentId,
  MLocalVideoViewer,
  MVideoId,
  MVideoPlaylistElement,
  MVideoUrl,
  MVideoUUID,
  MVideoWithHost
} from '../../types/models/index.js'
import { MVideoFileVideoUUID } from '../../types/models/video/video-file.js'
import { MVideoPlaylist, MVideoPlaylistUUID } from '../../types/models/video/video-playlist.js'
import { MStreamingPlaylist } from '../../types/models/video/video-streaming-playlist.js'

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

function getLocalVideoViewActivityPubUrl (byActor: MActorUrl, video: MVideoId, viewerIdentifier: string) {
  return byActor.url + '/views/videos/' + video.id + '/' + viewerIdentifier
}

function getLocalVideoViewerActivityPubUrl (stats: MLocalVideoViewer) {
  return WEBSERVER.URL + '/videos/local-viewer/' + stats.uuid
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

function getLocalVideoChaptersActivityPubUrl (video: MVideoUrl) {
  return video.url + '/chapters'
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

function getLocalActorFollowAcceptActivityPubUrl (actorFollow: MActorFollow) {
  return WEBSERVER.URL + '/accepts/follows/' + actorFollow.id
}

function getLocalActorFollowRejectActivityPubUrl () {
  return WEBSERVER.URL + '/rejects/follows/' + new Date().toISOString()
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

// ---------------------------------------------------------------------------

function getAbuseTargetUrl (abuse: MAbuseFull) {
  return abuse.VideoAbuse?.Video?.url ||
    abuse.VideoCommentAbuse?.VideoComment?.url ||
    abuse.FlaggedAccount.Actor.url
}

// ---------------------------------------------------------------------------

function buildRemoteUrl (video: MVideoWithHost, path: string, scheme?: string) {
  if (!scheme) scheme = REMOTE_SCHEME.HTTP

  const host = video.VideoChannel.Actor.Server.host

  return scheme + '://' + host + path
}

// ---------------------------------------------------------------------------

function checkUrlsSameHost (url1: string, url2: string) {
  const idHost = new URL(url1).host
  const actorHost = new URL(url2).host

  return idHost && actorHost && idHost.toLowerCase() === actorHost.toLowerCase()
}

// ---------------------------------------------------------------------------

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
  getLocalVideoChaptersActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl,
  getLocalVideoViewerActivityPubUrl,

  getAbuseTargetUrl,
  checkUrlsSameHost,
  buildRemoteUrl
}
