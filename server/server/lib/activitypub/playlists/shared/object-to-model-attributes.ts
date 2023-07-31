import { ACTIVITY_PUB } from '@server/initializers/constants.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element.js'
import { MVideoId, MVideoPlaylistId } from '@server/types/models/index.js'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { PlaylistElementObject, PlaylistObject, VideoPlaylistPrivacy } from '@peertube/peertube-models'

function playlistObjectToDBAttributes (playlistObject: PlaylistObject, to: string[]) {
  const privacy = to.includes(ACTIVITY_PUB.PUBLIC)
    ? VideoPlaylistPrivacy.PUBLIC
    : VideoPlaylistPrivacy.UNLISTED

  return {
    name: playlistObject.name,
    description: playlistObject.content,
    privacy,
    url: playlistObject.id,
    uuid: playlistObject.uuid,
    ownerAccountId: null,
    videoChannelId: null,
    createdAt: new Date(playlistObject.published),
    updatedAt: new Date(playlistObject.updated)
  } as AttributesOnly<VideoPlaylistModel>
}

function playlistElementObjectToDBAttributes (elementObject: PlaylistElementObject, videoPlaylist: MVideoPlaylistId, video: MVideoId) {
  return {
    position: elementObject.position,
    url: elementObject.id,
    startTimestamp: elementObject.startTimestamp || null,
    stopTimestamp: elementObject.stopTimestamp || null,
    videoPlaylistId: videoPlaylist.id,
    videoId: video.id
  } as AttributesOnly<VideoPlaylistElementModel>
}

export {
  playlistObjectToDBAttributes,
  playlistElementObjectToDBAttributes
}
