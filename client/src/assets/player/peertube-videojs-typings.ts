import { HlsConfig, Level } from 'hls.js'
import videojs from 'video.js'
import { VideoFile, VideoPlaylist, VideoPlaylistElement } from '@shared/models'
import { Html5Hlsjs } from './p2p-media-loader/hls-plugin'
import { P2pMediaLoaderPlugin } from './p2p-media-loader/p2p-media-loader-plugin'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { PlayerMode } from './peertube-player-manager'
import { PeerTubePlugin } from './peertube-plugin'
import { PeerTubeResolutionsPlugin } from './peertube-resolutions-plugin'
import { PlaylistPlugin } from './playlist/playlist-plugin'
import { StatsCardOptions } from './stats/stats-card'
import { StatsForNerdsPlugin } from './stats/stats-plugin'
import { EndCardOptions } from './upnext/end-card'
import { WebTorrentPlugin } from './webtorrent/webtorrent-plugin'

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

    stats (options?: StatsCardOptions): StatsForNerdsPlugin

    textTracks (): TextTrackList & {
      tracks_: (TextTrack & { id: string, label: string, src: string })[]
    }

    dock (options: { title: string, description: string }): void

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

type UserWatching = {
  url: string
  authorizationHeader: string
}

type PeerTubePluginOptions = {
  mode: PlayerMode

  autoplay: boolean
  videoViewUrl: string
  videoDuration: number

  userWatching?: UserWatching
  subtitle?: string

  videoCaptions: VideoJSCaption[]

  stopTime: number | string

  isLive: boolean

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
}

type WebtorrentPluginOptions = {
  playerElement: HTMLVideoElement

  autoplay: boolean
  videoDuration: number

  videoFiles: VideoFile[]

  startTime: number | string
}

type P2PMediaLoaderPluginOptions = {
  redundancyUrlManager: RedundancyUrlManager
  type: string
  src: string

  startTime: number | string
}

type VideoJSPluginOptions = {
  playlist?: PlaylistPluginOptions

  peertube: PeerTubePluginOptions

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
    uploadSpeed: number
    downloaded: number
    uploaded: number
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
  VideoJSCaption,
  UserWatching,
  PeerTubePluginOptions,
  WebtorrentPluginOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubeResolution,
  VideoJSPluginOptions,
  LoadedQualityData,
  PeerTubeLinkButtonOptions
}
