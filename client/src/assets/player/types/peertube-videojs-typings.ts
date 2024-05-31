import { HlsConfig, Level } from 'hls.js'
import videojs from 'video.js'
import { Engine } from '@peertube/p2p-media-loader-hlsjs'
import { VideoChapter, VideoFile, VideoPlaylist, VideoPlaylistElement } from '@peertube/peertube-models'
import { BezelsPlugin } from '../shared/bezels/bezels-plugin'
import { StoryboardPlugin } from '../shared/control-bar/storyboard-plugin'
import { PeerTubeDockPlugin, PeerTubeDockPluginOptions } from '../shared/dock/peertube-dock-plugin'
import { HotkeysOptions, PeerTubeHotkeysPlugin } from '../shared/hotkeys/peertube-hotkeys-plugin'
import { PeerTubeMobilePlugin } from '../shared/mobile/peertube-mobile-plugin'
import { Html5Hlsjs } from '../shared/p2p-media-loader/hls-plugin'
import { P2pMediaLoaderPlugin } from '../shared/p2p-media-loader/p2p-media-loader-plugin'
import { RedundancyUrlManager } from '../shared/p2p-media-loader/redundancy-url-manager'
import { PeerTubePlugin } from '../shared/peertube/peertube-plugin'
import { PlaylistPlugin } from '../shared/playlist/playlist-plugin'
import { PeerTubeResolutionsPlugin } from '../shared/resolutions/peertube-resolutions-plugin'
import { StatsCardOptions } from '../shared/stats/stats-card'
import { StatsForNerdsPlugin } from '../shared/stats/stats-plugin'
import { UpNextPlugin } from '../shared/upnext/upnext-plugin'
import { WebVideoPlugin } from '../shared/web-video/web-video-plugin'
import { PlayerMode } from './peertube-player-options'
import { SegmentValidator } from '../shared/p2p-media-loader/segment-validator'
import { ChaptersPlugin } from '../shared/control-bar/chapters-plugin'

declare module 'video.js' {

  export interface VideoJsPlayer {
    srOptions_: HlsjsConfigHandlerOptions

    theaterEnabled: boolean

    // FIXME: add it to upstream typings
    posterImage: {
      show (): void
      hide (): void
    }

    handleTechSeeked_ (): void

    textTracks (): TextTrackList & {
      tracks_: (TextTrack & { id: string, label: string, src: string })[]
    }

    // Plugins

    peertube (): PeerTubePlugin

    webVideo (options?: any): WebVideoPlugin

    p2pMediaLoader (options?: any): P2pMediaLoaderPlugin
    hlsjs (options?: any): any

    peertubeResolutions (): PeerTubeResolutionsPlugin

    contextmenuUI (options?: any): any

    bezels (): BezelsPlugin
    peertubeMobile (): PeerTubeMobilePlugin
    peerTubeHotkeysPlugin (options?: HotkeysOptions): PeerTubeHotkeysPlugin

    stats (options?: StatsCardOptions): StatsForNerdsPlugin

    storyboard (options?: StoryboardOptions): StoryboardPlugin

    peertubeDock (options?: PeerTubeDockPluginOptions): PeerTubeDockPlugin

    chapters (options?: ChaptersOptions): ChaptersPlugin

    upnext (options?: UpNextPluginOptions): UpNextPlugin

    playlist (options?: PlaylistPluginOptions): PlaylistPlugin
  }
}

export interface VideoJSTechHLS extends videojs.Tech {
  hlsProvider: Html5Hlsjs
}

export interface HlsjsConfigHandlerOptions {
  hlsjsConfig?: HlsConfig

  levelLabelHandler?: (level: Level) => string
}

type PeerTubeResolution = {
  id: number

  height?: number
  label?: string
  width?: number
  bitrate?: number

  selected: boolean
  selectCallback: () => void
}

type VideoJSCaption = {
  label: string
  language: string
  src: string
}

type VideoJSStoryboard = {
  url: string
  width: number
  height: number
  interval: number
}

type PeerTubePluginOptions = {
  autoPlayerRatio: {
    cssRatioVariable: string
    cssPlayerPortraitModeVariable: string
  }

  hasAutoplay: () => videojs.Autoplay

  videoViewUrl: () => string
  videoViewIntervalMs: number

  authorizationHeader?: () => string

  videoDuration: () => number

  startTime: () => number | string
  stopTime: () => number | string

  videoCaptions: () => VideoJSCaption[]
  isLive: () => boolean
  videoUUID: () => string
  subtitle: () => string

  videoRatio: () => number

  poster: () => string
}

type MetricsPluginOptions = {
  mode: () => PlayerMode
  metricsUrl: () => string
  metricsInterval: () => number
  videoUUID: () => string
}

type StoryboardOptions = {
  url: string
  width: number
  height: number
  interval: number
}

type ChaptersOptions = {
  chapters: VideoChapter[]
}

type PlaylistPluginOptions = {
  elements: VideoPlaylistElement[]

  playlist: VideoPlaylist

  getCurrentPosition: () => number

  onItemClicked: (element: VideoPlaylistElement) => void
}

type UpNextPluginOptions = {
  timeout: number

  next: () => void
  getTitle: () => string
  isDisplayed: () => boolean
  isSuspended: () => boolean
}

type ProgressBarMarkerComponentOptions = {
  timecode: number
}

type NextPreviousVideoButtonOptions = {
  type: 'next' | 'previous'
  handler?: () => void
  isDisplayed: () => boolean
  isDisabled: () => boolean
}

type PeerTubeLinkButtonOptions = {
  isDisplayed: () => boolean
  shortUUID: () => string
  instanceName: string
}

type TheaterButtonOptions = {
  isDisplayed: () => boolean
}

type WebVideoPluginOptions = {
  videoFiles: VideoFile[]
  videoFileToken: () => string
}

type P2PMediaLoaderPluginOptions = {
  redundancyUrlManager: RedundancyUrlManager | null
  segmentValidator: SegmentValidator | null

  type: string
  src: string

  p2pEnabled: boolean

  loader: P2PMediaLoader

  requiresUserAuth: boolean
  videoFileToken: () => string
}

export type P2PMediaLoader = {
  getEngine(): Engine

  destroy: () => void
}

type VideoJSPluginOptions = {
  playlist?: PlaylistPluginOptions

  peertube: PeerTubePluginOptions
  metrics: MetricsPluginOptions

  webVideo?: WebVideoPluginOptions

  p2pMediaLoader?: P2PMediaLoaderPluginOptions
}

type LoadedQualityData = {
  qualitySwitchCallback: (resolutionId: number, type: 'video') => void
  qualityData: {
    video: {
      id: number
      label: string
      selected: boolean
    }[]
  }
}

type ResolutionUpdateData = {
  auto: boolean
  resolutionId: number
  id?: number
}

type AutoResolutionUpdateData = {
  possible: boolean
}

type PlayerNetworkInfo = {
  source: 'web-video' | 'p2p-media-loader'

  http: {
    downloadSpeed?: number
    downloaded: number
  }

  p2p?: {
    downloadSpeed: number
    uploadSpeed: number

    downloaded: number
    uploaded: number

    peersWithWebSeed: number
    peersP2POnly: number
  }

  // In bytes
  bandwidthEstimate?: number
}

type PlaylistItemOptions = {
  element: VideoPlaylistElement

  onClicked: () => void
}

export {
  PlayerNetworkInfo,
  TheaterButtonOptions,
  VideoJSStoryboard,
  PlaylistItemOptions,
  NextPreviousVideoButtonOptions,
  ResolutionUpdateData,
  AutoResolutionUpdateData,
  ProgressBarMarkerComponentOptions,
  PlaylistPluginOptions,
  MetricsPluginOptions,
  VideoJSCaption,
  PeerTubePluginOptions,
  WebVideoPluginOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubeResolution,
  VideoJSPluginOptions,
  UpNextPluginOptions,
  LoadedQualityData,
  StoryboardOptions,
  ChaptersOptions,
  PeerTubeLinkButtonOptions
}
