import { VideoResolutionType } from '../videos/index.js'

export interface PlaybackMetricCreate {
  playerMode: 'p2p-media-loader' | 'web-video'

  resolution?: VideoResolutionType
  fps?: number

  p2pEnabled: boolean
  p2pPeers?: number

  resolutionChanges: number

  errors: number
  bufferStalled: number

  downloadedBytesP2P: number
  downloadedBytesHTTP: number

  uploadedBytesP2P: number

  videoId: number | string
}
