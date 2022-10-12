import { PluginsManager } from '@root-helpers/plugins-manager'
import { LiveVideoLatencyMode, VideoFile } from '@shared/models'
import { PlaylistPluginOptions, VideoJSCaption } from './peertube-videojs-typings'

export type PlayerMode = 'webtorrent' | 'p2p-media-loader'

export type WebtorrentOptions = {
  videoFiles: VideoFile[]
}

export type P2PMediaLoaderOptions = {
  playlistUrl: string
  segmentsSha256Url: string
  trackerAnnounce: string[]
  redundancyBaseUrls: string[]
  videoFiles: VideoFile[]
}

export interface CustomizationOptions {
  startTime: number | string
  stopTime: number | string

  controls?: boolean
  controlBar?: boolean

  muted?: boolean
  loop?: boolean
  subtitle?: string
  resume?: string

  peertubeLink: boolean
}

export interface CommonOptions extends CustomizationOptions {
  playerElement: HTMLVideoElement
  onPlayerElementChange: (element: HTMLVideoElement) => void

  autoplay: boolean
  p2pEnabled: boolean

  nextVideo?: () => void
  hasNextVideo?: () => boolean

  previousVideo?: () => void
  hasPreviousVideo?: () => boolean

  playlist?: PlaylistPluginOptions

  videoDuration: number
  enableHotkeys: boolean
  inactivityTimeout: number
  poster: string

  instanceName: string

  theaterButton: boolean
  captions: boolean

  videoViewUrl: string
  authorizationHeader?: () => string

  metricsUrl: string

  embedUrl: string
  embedTitle: string

  isLive: boolean
  liveOptions?: {
    latencyMode: LiveVideoLatencyMode
  }

  language?: string

  videoCaptions: VideoJSCaption[]

  videoUUID: string
  videoShortUUID: string

  serverUrl: string
  requiresAuth: boolean
  videoFileToken: () => string

  errorNotifier: (message: string) => void
}

export type PeertubePlayerManagerOptions = {
  common: CommonOptions
  webtorrent: WebtorrentOptions
  p2pMediaLoader?: P2PMediaLoaderOptions

  pluginsManager: PluginsManager
}
