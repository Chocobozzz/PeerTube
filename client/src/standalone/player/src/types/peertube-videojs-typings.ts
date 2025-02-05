import { VideoChapter, VideoFile, VideoPlaylist, VideoPlaylistElement } from '@peertube/peertube-models'
import type { HlsConfig, Level, Loader, LoaderContext } from 'hls.js'
import type { CoreConfig } from 'p2p-media-loader-core'
import type { HlsJsP2PEngine } from 'p2p-media-loader-hlsjs'
import videojs from 'video.js'
import { BezelsPlugin } from '../shared/bezels/bezels-plugin'
import { ContextMenuPlugin } from '../shared/context-menu'
import { ChaptersPlugin } from '../shared/control-bar/chapters-plugin'
import { StoryboardPlugin } from '../shared/control-bar/storyboard-plugin'
import { PeerTubeDockPlugin, PeerTubeDockPluginOptions } from '../shared/dock/peertube-dock-plugin'
import { HotkeysOptions, PeerTubeHotkeysPlugin } from '../shared/hotkeys/peertube-hotkeys-plugin'
import { PeerTubeMobilePlugin } from '../shared/mobile/peertube-mobile-plugin'
import { Html5Hlsjs } from '../shared/p2p-media-loader/hls-plugin'
import { P2pMediaLoaderPlugin } from '../shared/p2p-media-loader/p2p-media-loader-plugin'
import { RedundancyUrlManager } from '../shared/p2p-media-loader/redundancy-url-manager'
import { SegmentValidator } from '../shared/p2p-media-loader/segment-validator'
import { PeerTubePlugin } from '../shared/peertube/peertube-plugin'
import { PlaylistPlugin } from '../shared/playlist/playlist-plugin'
import { PeerTubeResolutionsPlugin } from '../shared/resolutions/peertube-resolutions-plugin'
import { StatsCardOptions } from '../shared/stats/stats-card'
import { StatsForNerdsPlugin } from '../shared/stats/stats-plugin'
import { UpNextPlugin } from '../shared/upnext/upnext-plugin'
import { WebVideoPlugin } from '../shared/web-video/web-video-plugin'
import { PlayerMode } from './peertube-player-options'

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

    contextMenu (options?: ContextMenuPluginOptions): ContextMenuPlugin

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

  levelLabelHandler?: (level: Level, player: videojs.Player) => string
}

export type PeerTubeResolution = {
  id: number

  height?: number
  label?: string
  width?: number
  bitrate?: number

  selected: boolean
  selectCallback: () => void
}

export type VideoJSCaption = {
  label: string
  language: string
  src: string
  automaticallyGenerated: boolean
}

export type VideoJSStoryboard = {
  url: string
  width: number
  height: number
  interval: number
}

export type PeerTubePluginOptions = {
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

export type MetricsPluginOptions = {
  mode: () => PlayerMode
  metricsUrl: () => string
  metricsInterval: () => number
  videoUUID: () => string
}

export type ContextMenuPluginOptions = {
  content: () => {
    icon?: string
    label: string
    listener: () => void
  }[]
}

export type ContextMenuItemOptions = {
  listener: (e: videojs.EventTarget.Event) => void
  label: string
}

export type StoryboardOptions = {
  url: string
  width: number
  height: number
  interval: number
}

export type ChaptersOptions = {
  chapters: VideoChapter[]
}

export type PlaylistPluginOptions = {
  elements: VideoPlaylistElement[]

  playlist: VideoPlaylist

  getCurrentPosition: () => number

  onItemClicked: (element: VideoPlaylistElement) => void
}

export type UpNextPluginOptions = {
  timeout: number

  next: () => void
  getTitle: () => string
  isDisplayed: () => boolean
  isSuspended: () => boolean
}

export type ProgressBarMarkerComponentOptions = {
  timecode: number
}

export type NextPreviousVideoButtonOptions = {
  type: 'next' | 'previous'
  handler?: () => void
  isDisplayed: () => boolean
  isDisabled: () => boolean
}

export type PeerTubeLinkButtonOptions = {
  isDisplayed: () => boolean
  shortUUID: () => string
  instanceName: string
}

export type TheaterButtonOptions = {
  isDisplayed: () => boolean
}

export type WebVideoPluginOptions = {
  videoFiles: VideoFile[]
  videoFileToken: () => string
}

export type HLSLoaderClass = {
  new (confg: HlsConfig): Loader<LoaderContext>

  getEngine(): HlsJsP2PEngine
}
export type HLSPluginOptions = Partial<HlsConfig & { cueHandler: any, p2pMediaLoaderOptions: CoreConfig }>

export type P2PMediaLoaderPluginOptions = {
  redundancyUrlManager: RedundancyUrlManager | null
  segmentValidator: SegmentValidator | null

  type: string
  src: string

  p2pEnabled: boolean

  requiresUserAuth: boolean
  videoFileToken: () => string
}

export type P2PMediaLoader = {
  getEngine(): HlsJsP2PEngine

  destroy: () => void
}

export type VideoJSPluginOptions = {
  playlist?: PlaylistPluginOptions

  peertube: PeerTubePluginOptions
  metrics: MetricsPluginOptions

  webVideo?: WebVideoPluginOptions

  p2pMediaLoader?: P2PMediaLoaderPluginOptions
}

export type LoadedQualityData = {
  qualitySwitchCallback: (resolutionId: number, type: 'video') => void
  qualityData: {
    video: {
      id: number
      label: string
      selected: boolean
    }[]
  }
}

export type ResolutionUpdateData = {
  auto: boolean
  resolutionId: number
  id?: number
}

export type AutoResolutionUpdateData = {
  possible: boolean
}

export type PlayerNetworkInfo = {
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

export type PlaylistItemOptions = {
  element: VideoPlaylistElement

  onClicked: () => void
}
