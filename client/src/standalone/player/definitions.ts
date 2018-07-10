export interface EventHandler<T> {
  (ev: T): void
}

export type PlayerEventType =
  'pause' | 'play' |
  'playbackStatusUpdate' |
  'playbackStatusChange' |
  'resolutionUpdate'

export interface PeerTubeResolution {
  id: any
  label: string
  src: string
  active: boolean
}
