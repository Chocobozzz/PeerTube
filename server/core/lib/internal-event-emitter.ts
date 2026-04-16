import { MChannel, MVideo, MVideoImmutable, MVideoPlaylist, MVideoPlaylistElement } from '@server/types/models/index.js'
import { EventEmitter } from 'events'

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

  'chapters-updated': (options: { video: MVideoImmutable }) => void
}

// oxlint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
declare interface InternalEventEmitter {
  on<U extends keyof PeerTubeInternalEvents>(
    event: U,
    listener: PeerTubeInternalEvents[U]
  ): this

  emit<U extends keyof PeerTubeInternalEvents>(
    event: U,
    ...args: Parameters<PeerTubeInternalEvents[U]>
  ): boolean
}

// oxlint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class InternalEventEmitter extends EventEmitter {
  private static instance: InternalEventEmitter

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  InternalEventEmitter
}
