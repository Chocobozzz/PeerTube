export type EventHandler<T> = (ev: T) => void

export type PlayerEventType =
  'pause' | 'play' |
  'playbackStatusUpdate' |
  'playbackStatusChange' |
  'resolutionUpdate' |
  'volumeChange'

export interface PeerTubeResolution {
  id: any
  label: string
  active: boolean
  height: number

  src?: string
  width?: number
}

export type PeerTubeTextTrack = {
  id: string
  label: string
  src: string
  mode: 'showing' | 'disabled'
}
