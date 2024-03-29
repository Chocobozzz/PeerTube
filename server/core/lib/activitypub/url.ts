import { REMOTE_SCHEME, WEBSERVER } from '../../initializers/constants.js'
import {
  MAbuseFull,
  MAbuseId,
  MActor,
  MActorFollow,
  MActorId,
  MActorUrl,
  MCommentId, MLocalVideoViewer,
  MVideoId,
  MVideoPlaylistElement,
  MVideoUUID,
  MVideoUrl,
  MVideoWithHost
} from '../../types/models/index.js'
import { MVideoFileVideoUUID } from '../../types/models/video/video-file.js'
import { MVideoPlaylist, MVideoPlaylistUUID } from '../../types/models/video/video-playlist.js'
import { MStreamingPlaylist } from '../../types/models/video/video-streaming-playlist.js'

export function getLocalVideoActivityPubUrl (video: MVideoUUID) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid
}

export function getLocalVideoPlaylistActivityPubUrl (videoPlaylist: MVideoPlaylist) {
  return WEBSERVER.URL + '/video-playlists/' + videoPlaylist.uuid
}

export function getLocalVideoPlaylistElementActivityPubUrl (playlist: MVideoPlaylistUUID, element: MVideoPlaylistElement) {
  return WEBSERVER.URL + '/video-playlists/' + playlist.uuid + '/videos/' + element.id
}

export function getLocalVideoCacheFileActivityPubUrl (videoFile: MVideoFileVideoUUID) {
  const suffixFPS = videoFile.fps && videoFile.fps !== -1 ? '-' + videoFile.fps : ''

  return `${WEBSERVER.URL}/redundancy/videos/${videoFile.Video.uuid}/${videoFile.resolution}${suffixFPS}`
}

export function getLocalVideoCacheStreamingPlaylistActivityPubUrl (video: MVideoUUID, playlist: MStreamingPlaylist) {
  return `${WEBSERVER.URL}/redundancy/streaming-playlists/${playlist.getStringType()}/${video.uuid}`
}

export function getLocalVideoCommentActivityPubUrl (video: MVideoUUID, videoComment: MCommentId) {
  return WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id
}

export function getLocalVideoChannelActivityPubUrl (videoChannelName: string) {
  return WEBSERVER.URL + '/video-channels/' + videoChannelName
}

export function getLocalAccountActivityPubUrl (accountName: string) {
  return WEBSERVER.URL + '/accounts/' + accountName
}

export function getLocalAbuseActivityPubUrl (abuse: MAbuseId) {
  return WEBSERVER.URL + '/admin/abuses/' + abuse.id
}

export function getLocalVideoViewActivityPubUrl (byActor: MActorUrl, video: MVideoId, viewerIdentifier: string) {
  return byActor.url + '/views/videos/' + video.id + '/' + viewerIdentifier
}

export function getLocalVideoViewerActivityPubUrl (stats: MLocalVideoViewer) {
  return WEBSERVER.URL + '/videos/local-viewer/' + stats.uuid
}

export function getVideoLikeActivityPubUrlByLocalActor (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/likes/' + video.id
}

export function getVideoDislikeActivityPubUrlByLocalActor (byActor: MActorUrl, video: MVideoId) {
  return byActor.url + '/dislikes/' + video.id
}

export function getLocalVideoSharesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/announces'
}

export function getLocalVideoCommentsActivityPubUrl (video: MVideoUrl) {
  return video.url + '/comments'
}

export function getLocalVideoChaptersActivityPubUrl (video: MVideoUrl) {
  return video.url + '/chapters'
}

export function getLocalVideoLikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/likes'
}

export function getLocalVideoDislikesActivityPubUrl (video: MVideoUrl) {
  return video.url + '/dislikes'
}

export function getLocalActorFollowActivityPubUrl (follower: MActor, following: MActorId) {
  return follower.url + '/follows/' + following.id
}

export function getLocalActorFollowAcceptActivityPubUrl (actorFollow: MActorFollow) {
  return WEBSERVER.URL + '/accepts/follows/' + actorFollow.id
}

export function getLocalActorFollowRejectActivityPubUrl () {
  return WEBSERVER.URL + '/rejects/follows/' + new Date().toISOString()
}

export function getLocalVideoAnnounceActivityPubUrl (byActor: MActorId, video: MVideoUrl) {
  return video.url + '/announces/' + byActor.id
}

export function getDeleteActivityPubUrl (originalUrl: string) {
  return originalUrl + '/delete'
}

export function getUpdateActivityPubUrl (originalUrl: string, updatedAt: string) {
  return originalUrl + '/updates/' + updatedAt
}

export function getUndoActivityPubUrl (originalUrl: string) {
  return originalUrl + '/undo'
}

export function getLocalApproveReplyActivityPubUrl (video: MVideoUUID, comment: MCommentId) {
  return getLocalVideoCommentActivityPubUrl(video, comment) + '/approve-reply'
}

// ---------------------------------------------------------------------------

export function getAbuseTargetUrl (abuse: MAbuseFull) {
  return abuse.VideoAbuse?.Video?.url ||
    abuse.VideoCommentAbuse?.VideoComment?.url ||
    abuse.FlaggedAccount.Actor.url
}

// ---------------------------------------------------------------------------

export function buildRemoteUrl (video: MVideoWithHost, path: string, scheme?: string) {
  if (!scheme) scheme = REMOTE_SCHEME.HTTP

  const host = video.VideoChannel.Actor.Server.host

  return scheme + '://' + host + path
}

// ---------------------------------------------------------------------------

export function checkUrlsSameHost (url1: string, url2: string) {
  const idHost = new URL(url1).host
  const actorHost = new URL(url2).host

  return idHost && actorHost && idHost.toLowerCase() === actorHost.toLowerCase()
}
