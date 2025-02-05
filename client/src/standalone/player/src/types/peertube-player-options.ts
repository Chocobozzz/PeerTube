import { LiveVideoLatencyModeType, VideoChapter, VideoFile } from '@peertube/peertube-models'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { PeerTubeDockPluginOptions } from '../shared/dock/peertube-dock-plugin'
import { PlaylistPluginOptions, VideoJSCaption, VideoJSStoryboard } from './peertube-videojs-typings'

export type PlayerMode = 'web-video' | 'p2p-media-loader'

export type PeerTubePlayerConstructorOptions = {
  playerElement: () => HTMLVideoElement

  controls: boolean
  controlBar: boolean

  muted: boolean
  loop: boolean

  peertubeLink: () => boolean

  playbackRate?: number | string

  enableHotkeys: boolean
  inactivityTimeout: number

  videoViewIntervalMs: number

  instanceName: string

  theaterButton: boolean

  authorizationHeader: () => string

  metricsUrl: string
  metricsInterval: number

  serverUrl: string

  errorNotifier: (message: string) => void

  // Current web browser language
  language: string

  pluginsManager: PluginsManager

  stunServers: string[]

  autoPlayerRatio?: {
    cssRatioVariable: string
    cssPlayerPortraitModeVariable: string
  }
}

export type PeerTubePlayerLoadOptions = {
  mode: PlayerMode

  startTime?: number | string
  stopTime?: number | string

  autoplay: boolean
  forceAutoplay: boolean

  poster: string
  subtitle?: string
  videoViewUrl: string

  embedUrl: string
  embedTitle: string

  isLive: boolean

  liveOptions?: {
    latencyMode: LiveVideoLatencyModeType
  }

  videoCaptions: VideoJSCaption[]
  videoChapters: VideoChapter[]
  storyboard: VideoJSStoryboard

  videoUUID: string
  videoShortUUID: string

  duration: number
  videoRatio: number

  requiresUserAuth: boolean
  videoFileToken: () => string
  requiresPassword: boolean
  videoPassword: () => string

  nextVideo: {
    enabled: boolean
    getVideoTitle: () => string
    handler?: () => void
    displayControlBarButton: boolean
  }

  previousVideo: {
    enabled: boolean
    handler?: () => void
    displayControlBarButton: boolean
  }

  upnext?: {
    isEnabled: () => boolean
    isSuspended: (player: videojs.VideoJsPlayer) => boolean
    timeout: number
  }

  dock?: PeerTubeDockPluginOptions

  playlist?: PlaylistPluginOptions

  p2pEnabled: boolean

  hls?: HLSOptions
  webVideo?: WebVideoOptions
}

export type WebVideoOptions = {
  videoFiles: VideoFile[]
}

export type HLSOptions = {
  playlistUrl: string
  segmentsSha256Url: string
  trackerAnnounce: string[]
  redundancyBaseUrls: string[]
  videoFiles: VideoFile[]
}
