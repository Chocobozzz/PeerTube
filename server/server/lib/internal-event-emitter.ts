import { MChannel, MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { EventEmitter } from 'events'

export interface PeerTubeInternalEvents {
  'video-created': (options: { video: MVideo }) => void
  'video-updated': (options: { video: MVideo }) => void
  'video-deleted': (options: { video: MVideo }) => void

  'channel-created': (options: { channel: MChannel }) => void
  'channel-updated': (options: { channel: MChannel }) => void
  'channel-deleted': (options: { channel: MChannel }) => void

  'chapters-updated': (options: { video: MVideoImmutable }) => void
}

declare interface InternalEventEmitter {
  on<U extends keyof PeerTubeInternalEvents>(
    event: U, listener: PeerTubeInternalEvents[U]
  ): this

  emit<U extends keyof PeerTubeInternalEvents>(
    event: U, ...args: Parameters<PeerTubeInternalEvents[U]>
  ): boolean
}

class InternalEventEmitter extends EventEmitter {

  private static instance: InternalEventEmitter

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  InternalEventEmitter
}
