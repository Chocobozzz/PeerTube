// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import * as videojs from 'video.js'

import { PeerTubePlugin } from './peertube-plugin'
import { WebTorrentPlugin } from './webtorrent/webtorrent-plugin'
import { P2pMediaLoaderPlugin } from './p2p-media-loader/p2p-media-loader-plugin'
import { PlayerMode } from './peertube-player-manager'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { VideoFile } from '@shared/models'

declare namespace videojs {
  interface Player {
    peertube (): PeerTubePlugin
    webtorrent (): WebTorrentPlugin
    p2pMediaLoader (): P2pMediaLoaderPlugin
  }
}

interface VideoJSComponentInterface {
  _player: videojs.Player

  new (player: videojs.Player, options?: any): any

  registerComponent (name: string, obj: any): any
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

// videojs typings don't have some method we need
const videojsUntyped = videojs as any

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
  VideoJSComponentInterface,
  videojsUntyped,
  VideoJSCaption,
  UserWatching,
  PeerTubePluginOptions,
  WebtorrentPluginOptions,
  P2PMediaLoaderPluginOptions,
  VideoJSPluginOptions,
  LoadedQualityData
}
