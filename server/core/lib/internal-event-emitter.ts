import { TypedEventEmitter } from '@peertube/peertube-node-utils'
import { MChannel, MVideo, MVideoPlaylist, MVideoPlaylistElement } from '@server/types/models/index.js'

export interface PeerTubeInternalEvents {
  'video-created': (options: { video: MVideo }) => void
  'video-updated': (options: { video: MVideo }) => void
  'video-deleted': (options: { video: MVideo }) => void

  'channel-created': (options: { channel: MChannel }) => void
  'channel-updated': (options: { channel: MChannel }) => void
  'channel-deleted': (options: { channel: MChannel }) => void

  'playlist-created': (options: { playlist: MVideoPlaylist }) => void
  'playlist-updated': (options: { playlist: MVideoPlaylist }) => void
  'playlist-deleted': (options: { playlist: MVideoPlaylist }) => void

  'playlist-element-created': (options: { playlistElement: MVideoPlaylistElement }) => void
  'playlist-element-updated': (options: { playlistElement: MVideoPlaylistElement }) => void
  'playlist-element-deleted': (options: { playlistElement: MVideoPlaylistElement }) => void

  'chapters-updated': (options: { video: MVideo }) => void
}

class InternalEventEmitter extends TypedEventEmitter<PeerTubeInternalEvents> {
  private static instance: InternalEventEmitter

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  InternalEventEmitter
}
