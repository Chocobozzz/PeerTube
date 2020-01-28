import videojs from 'video.js'
import { PeerTubePlugin } from './peertube-plugin'
import { WebTorrentPlugin } from './webtorrent/webtorrent-plugin'
import { P2pMediaLoaderPlugin } from './p2p-media-loader/p2p-media-loader-plugin'
import { PlayerMode } from './peertube-player-manager'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { VideoFile } from '@shared/models'

declare module 'video.js' {
  export interface VideoJsPlayer {
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

    qualityLevels (): { height: number, id: number }[] & {
      selectedIndex: number

      addQualityLevel (representation: {
        id: number
        label: string
        height: number,
        _enabled: boolean
      }): void
    }

    textTracks (): TextTrackList & {
      on: Function
      tracks_: { kind: string, mode: string, language: string }[]
    }
  }
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
  LoadedQualityData
}
