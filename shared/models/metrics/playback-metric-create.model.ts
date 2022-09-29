import { VideoResolution } from '../videos'

export interface PlaybackMetricCreate {
  playerMode: 'p2p-media-loader' | 'webtorrent'

  resolution?: VideoResolution
  fps?: number

  resolutionChanges: number

  errors: number

  downloadedBytesP2P: number
  downloadedBytesHTTP: number

  uploadedBytesP2P: number

  videoId: number | string
}
