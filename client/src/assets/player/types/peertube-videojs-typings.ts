import { HlsConfig, Level } from 'hls.js'
import videojs from 'video.js'
import { Engine } from '@peertube/p2p-media-loader-hlsjs'
import { VideoFile, VideoPlaylist, VideoPlaylistElement } from '@shared/models'
import { PeerTubeDockPluginOptions } from '../shared/dock/peertube-dock-plugin'
import { Html5Hlsjs } from '../shared/p2p-media-loader/hls-plugin'
import { P2pMediaLoaderPlugin } from '../shared/p2p-media-loader/p2p-media-loader-plugin'
import { RedundancyUrlManager } from '../shared/p2p-media-loader/redundancy-url-manager'
import { PeerTubePlugin } from '../shared/peertube/peertube-plugin'
import { PlaylistPlugin } from '../shared/playlist/playlist-plugin'
import { PeerTubeResolutionsPlugin } from '../shared/resolutions/peertube-resolutions-plugin'
import { StatsCardOptions } from '../shared/stats/stats-card'
import { StatsForNerdsPlugin } from '../shared/stats/stats-plugin'
import { EndCardOptions } from '../shared/upnext/end-card'
import { WebTorrentPlugin } from '../shared/webtorrent/webtorrent-plugin'
import { PlayerMode } from './manager-options'

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

    // Plugins

    peertube (): PeerTubePlugin

    webtorrent (): WebTorrentPlugin

    p2pMediaLoader (): P2pMediaLoaderPlugin

    peertubeResolutions (): PeerTubeResolutionsPlugin

    contextmenuUI (options: any): any

    bezels (): void
    peertubeMobile (): void
    peerTubeHotkeysPlugin (): void

    stats (options?: StatsCardOptions): StatsForNerdsPlugin

    textTracks (): TextTrackList & {
      tracks_: (TextTrack & { id: string, label: string, src: string })[]
    }

    peertubeDock (options: PeerTubeDockPluginOptions): void

    upnext (options: Partial<EndCardOptions>): void

    playlist (): PlaylistPlugin
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

type PeerTubePluginOptions = {
  mode: PlayerMode

  autoplay: boolean
  videoDuration: number

  videoViewUrl: string
  authorizationHeader?: () => string

  subtitle?: string

  videoCaptions: VideoJSCaption[]

  startTime: number | string
  stopTime: number | string

  isLive: boolean

  videoUUID: string
}

type MetricsPluginOptions = {
  mode: PlayerMode
  metricsUrl: string
  videoUUID: string
}

type PlaylistPluginOptions = {
  elements: VideoPlaylistElement[]

  playlist: VideoPlaylist

  getCurrentPosition: () => number

  onItemClicked: (element: VideoPlaylistElement) => void
}

type NextPreviousVideoButtonOptions = {
  type: 'next' | 'previous'
  handler: () => void
  isDisabled: () => boolean
}

type PeerTubeLinkButtonOptions = {
  shortUUID: string
  instanceName: string
}

type PeerTubeP2PInfoButtonOptions = {
  p2pEnabled: boolean
}

type WebtorrentPluginOptions = {
  playerElement: HTMLVideoElement

  autoplay: boolean
  videoDuration: number

  videoFiles: VideoFile[]

  startTime: number | string

  playerRefusedP2P: boolean

  requiresAuth: boolean
  videoFileToken: () => string

  buildWebSeedUrls: (file: VideoFile) => string[]
}

type P2PMediaLoaderPluginOptions = {
  redundancyUrlManager: RedundancyUrlManager
  type: string
  src: string

  startTime: number | string

  loader: P2PMediaLoader

  requiresAuth: boolean
}

export type P2PMediaLoader = {
  getEngine(): Engine
}

type VideoJSPluginOptions = {
  playlist?: PlaylistPluginOptions

  peertube: PeerTubePluginOptions
  metrics: MetricsPluginOptions

  webtorrent?: WebtorrentPluginOptions

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
  source: 'webtorrent' | 'p2p-media-loader'

  http: {
    downloadSpeed: number
    downloaded: number
  }

  p2p: {
    downloadSpeed: number
    uploadSpeed: number
    downloaded: number
    uploaded: number
    numPeers: number
  }

  // In bytes
  bandwidthEstimate: number
}

type PlaylistItemOptions = {
  element: VideoPlaylistElement

  onClicked: () => void
}

export {
  PlayerNetworkInfo,
  PlaylistItemOptions,
  NextPreviousVideoButtonOptions,
  ResolutionUpdateData,
  AutoResolutionUpdateData,
  PlaylistPluginOptions,
  MetricsPluginOptions,
  VideoJSCaption,
  PeerTubePluginOptions,
  WebtorrentPluginOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubeResolution,
  VideoJSPluginOptions,
  LoadedQualityData,
  PeerTubeLinkButtonOptions,
  PeerTubeP2PInfoButtonOptions
}
