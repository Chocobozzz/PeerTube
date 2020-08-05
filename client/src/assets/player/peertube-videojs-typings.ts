import { Config, Level } from 'hls.js'
import videojs from 'video.js'
import { VideoFile, VideoPlaylist, VideoPlaylistElement } from '@shared/models'
import { P2pMediaLoaderPlugin } from './p2p-media-loader/p2p-media-loader-plugin'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { PlayerMode } from './peertube-player-manager'
import { PeerTubePlugin } from './peertube-plugin'
import { PlaylistPlugin } from './playlist/playlist-plugin'
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

    contextmenuUI (options: any): any

    bezels (): void

    qualityLevels (): QualityLevels

    textTracks (): TextTrackList & {
      on: Function
      tracks_: (TextTrack & { id: string, label: string, src: string })[]
    }

    dock (options: { title: string, description: string }): void

    upnext (options: Partial<EndCardOptions>): void

    playlist (): PlaylistPlugin
  }
}

export interface VideoJSTechHLS extends videojs.Tech {
  hlsProvider: any // FIXME: typings
}

export interface HlsjsConfigHandlerOptions {
  hlsjsConfig?: Config & { cueHandler: any }// FIXME: typings
  captionConfig?: any // FIXME: typings

  levelLabelHandler?: (level: Level) => string
}

type QualityLevelRepresentation = {
  id: number
  height: number

  label?: string
  width?: number
  bandwidth?: number
  bitrate?: number

  enabled?: Function
  _enabled: boolean
}

type QualityLevels = QualityLevelRepresentation[] & {
  selectedIndex: number
  selectedIndex_: number

  addQualityLevel (representation: QualityLevelRepresentation): void
}

type VideoJSCaption = {
  label: string
  language: string
  src: string
}

type UserWatching = {
  url: string,
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
}

type PlaylistPluginOptions = {
  elements: VideoPlaylistElement[]

  playlist: VideoPlaylist

  getCurrentPosition: () => number

  onItemClicked: (element: VideoPlaylistElement) => void
}

type NextPreviousVideoButtonOptions = {
  type: 'next' | 'previous'
  handler: Function
  isDisabled: () => boolean
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
  qualitySwitchCallback: Function,
  qualityData: {
    video: {
      id: number
      label: string
      selected: boolean
    }[]
  }
}

type ResolutionUpdateData = {
  auto: boolean,
  resolutionId: number
  id?: number
}

type AutoResolutionUpdateData = {
  possible: boolean
}

type PlayerNetworkInfo = {
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
}

type PlaylistItemOptions = {
  element: VideoPlaylistElement

  onClicked: Function
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
  VideoJSPluginOptions,
  LoadedQualityData,
  QualityLevelRepresentation,
  QualityLevels
}
