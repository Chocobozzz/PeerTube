import { PeerTubePlugin } from './peertube-plugin'
import { WebTorrentPlugin } from './webtorrent/webtorrent-plugin'
import { P2pMediaLoaderPlugin } from './p2p-media-loader/p2p-media-loader-plugin'
import { PlayerMode } from './peertube-player-manager'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { VideoFile } from '@shared/models'
import videojs from 'video.js'
import { Config, Level } from 'hls.js'

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
      tracks_: { kind: string, mode: string, language: string }[]
    }

    audioTracks (): AudioTrackList

    dock (options: { title: string, description: string }): void
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

export {
  PlayerNetworkInfo,
  ResolutionUpdateData,
  AutoResolutionUpdateData,
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
