import videojs from 'video.js'
import { HybridLoaderSettings } from '@peertube/p2p-media-loader-core'
import { HlsJsEngineSettings } from '@peertube/p2p-media-loader-hlsjs'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { buildVideoLink, decorateVideoLink } from '@shared/core-utils'
import { isDefaultLocale } from '@shared/core-utils/i18n'
import { LiveVideoLatencyMode, VideoFile } from '@shared/models'
import { copyToClipboard } from '../../root-helpers/utils'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { segmentUrlBuilderFactory } from './p2p-media-loader/segment-url-builder'
import { segmentValidatorFactory } from './p2p-media-loader/segment-validator'
import { getAverageBandwidthInStore } from './peertube-player-local-storage'
import {
  NextPreviousVideoButtonOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubeLinkButtonOptions,
  PlaylistPluginOptions,
  UserWatching,
  VideoJSCaption,
  VideoJSPluginOptions
} from './peertube-videojs-typings'
import { buildVideoOrPlaylistEmbed, getRtcConfig, isIOS, isSafari } from './utils'

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

  theaterButton: boolean
  captions: boolean

  videoViewUrl: string
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

  userWatching?: UserWatching

  serverUrl: string

  errorNotifier: (message: string) => void
}

export type PeertubePlayerManagerOptions = {
  common: CommonOptions
  webtorrent: WebtorrentOptions
  p2pMediaLoader?: P2PMediaLoaderOptions

  pluginsManager: PluginsManager
}

export class PeertubePlayerOptionsBuilder {

  constructor (
    private mode: PlayerMode,
    private options: PeertubePlayerManagerOptions,
    private p2pMediaLoaderModule?: any
  ) {

  }

  getVideojsOptions (alreadyPlayed: boolean): videojs.PlayerOptions {
    const commonOptions = this.options.common
    const isHLS = this.mode === 'p2p-media-loader'

    let autoplay = this.getAutoPlayValue(commonOptions.autoplay, alreadyPlayed)
    const html5 = {
      preloadTextTracks: false
    }

    const plugins: VideoJSPluginOptions = {
      peertube: {
        mode: this.mode,
        autoplay, // Use peertube plugin autoplay because we could get the file by webtorrent
        videoViewUrl: commonOptions.videoViewUrl,
        videoDuration: commonOptions.videoDuration,
        userWatching: commonOptions.userWatching,
        subtitle: commonOptions.subtitle,
        videoCaptions: commonOptions.videoCaptions,
        stopTime: commonOptions.stopTime,
        isLive: commonOptions.isLive,
        videoUUID: commonOptions.videoUUID
      }
    }

    if (commonOptions.playlist) {
      plugins.playlist = commonOptions.playlist
    }

    if (isHLS) {
      const { hlsjs } = this.addP2PMediaLoaderOptions(plugins)

      Object.assign(html5, hlsjs.html5)
    }

    if (this.mode === 'webtorrent') {
      this.addWebTorrentOptions(plugins, alreadyPlayed)

      // WebTorrent plugin handles autoplay, because we do some hackish stuff in there
      autoplay = false
    }

    const videojsOptions = {
      html5,

      // We don't use text track settings for now
      textTrackSettings: false as any, // FIXME: typings
      controls: commonOptions.controls !== undefined ? commonOptions.controls : true,
      loop: commonOptions.loop !== undefined ? commonOptions.loop : false,

      muted: commonOptions.muted !== undefined
        ? commonOptions.muted
        : undefined, // Undefined so the player knows it has to check the local storage

      autoplay: this.getAutoPlayValue(autoplay, alreadyPlayed),

      poster: commonOptions.poster,
      inactivityTimeout: commonOptions.inactivityTimeout,
      playbackRates: [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ],

      plugins,

      controlBar: {
        children: this.getControlBarChildren(this.mode, {
          videoShortUUID: commonOptions.videoShortUUID,
          p2pEnabled: commonOptions.p2pEnabled,

          captions: commonOptions.captions,
          peertubeLink: commonOptions.peertubeLink,
          theaterButton: commonOptions.theaterButton,

          nextVideo: commonOptions.nextVideo,
          hasNextVideo: commonOptions.hasNextVideo,

          previousVideo: commonOptions.previousVideo,
          hasPreviousVideo: commonOptions.hasPreviousVideo
        }) as any // FIXME: typings
      }
    }

    if (commonOptions.language && !isDefaultLocale(commonOptions.language)) {
      Object.assign(videojsOptions, { language: commonOptions.language })
    }

    return videojsOptions
  }

  private addP2PMediaLoaderOptions (plugins: VideoJSPluginOptions) {
    const p2pMediaLoaderOptions = this.options.p2pMediaLoader
    const commonOptions = this.options.common

    const redundancyUrlManager = new RedundancyUrlManager(this.options.p2pMediaLoader.redundancyBaseUrls)

    const p2pMediaLoader: P2PMediaLoaderPluginOptions = {
      redundancyUrlManager,
      type: 'application/x-mpegURL',
      startTime: commonOptions.startTime,
      src: p2pMediaLoaderOptions.playlistUrl
    }

    const p2pMediaLoaderConfig: HlsJsEngineSettings = {
      loader: this.getP2PMediaLoaderOptions(redundancyUrlManager),
      segments: {
        swarmId: p2pMediaLoaderOptions.playlistUrl
      }
    }

    const hlsjs = {
      levelLabelHandler: (level: { height: number, width: number }) => {
        const resolution = Math.min(level.height || 0, level.width || 0)

        const file = p2pMediaLoaderOptions.videoFiles.find(f => f.resolution.id === resolution)
        // We don't have files for live videos
        if (!file) return level.height

        let label = file.resolution.label
        if (file.fps >= 50) label += file.fps

        return label
      },
      html5: {
        hlsjsConfig: this.getHLSOptions(p2pMediaLoaderConfig)
      }
    }

    const toAssign = { p2pMediaLoader, hlsjs }
    Object.assign(plugins, toAssign)

    return toAssign
  }

  private getP2PMediaLoaderOptions (redundancyUrlManager: RedundancyUrlManager): Partial<HybridLoaderSettings> {
    let consumeOnly = false
    if ((navigator as any)?.connection?.type === 'cellular') {
      console.log('We are on a cellular connection: disabling seeding.')
      consumeOnly = true
    }

    const trackerAnnounce = this.options.p2pMediaLoader.trackerAnnounce
                                                 .filter(t => t.startsWith('ws'))

    const specificLiveOrVODOptions = this.options.common.isLive
      ? this.getP2PMediaLoaderLiveOptions()
      : this.getP2PMediaLoaderVODOptions()

    return {
      trackerAnnounce,
      rtcConfig: getRtcConfig(),

      simultaneousHttpDownloads: 1,
      httpFailedSegmentTimeout: 1000,

      segmentValidator: segmentValidatorFactory(this.options.p2pMediaLoader.segmentsSha256Url, this.options.common.isLive),
      segmentUrlBuilder: segmentUrlBuilderFactory(redundancyUrlManager, 1),

      useP2P: this.options.common.p2pEnabled,
      consumeOnly,

      ...specificLiveOrVODOptions
    }
  }

  private getP2PMediaLoaderLiveOptions (): Partial<HybridLoaderSettings> {
    const base = {
      requiredSegmentsPriority: 1
    }

    const latencyMode = this.options.common.liveOptions.latencyMode

    switch (latencyMode) {
      case LiveVideoLatencyMode.SMALL_LATENCY:
        return {
          ...base,

          useP2P: false,
          httpDownloadProbability: 1
        }

      case LiveVideoLatencyMode.HIGH_LATENCY:
        return base

      default:
        return base
    }
  }

  private getP2PMediaLoaderVODOptions (): Partial<HybridLoaderSettings> {
    return {
      requiredSegmentsPriority: 3,

      cachedSegmentExpiration: 86400000,
      cachedSegmentsCount: 100,

      httpDownloadMaxPriority: 9,
      httpDownloadProbability: 0.06,
      httpDownloadProbabilitySkipIfNoPeers: true,

      p2pDownloadMaxPriority: 50
    }
  }

  private getHLSOptions (p2pMediaLoaderConfig: HlsJsEngineSettings) {
    const specificLiveOrVODOptions = this.options.common.isLive
      ? this.getHLSLiveOptions()
      : this.getHLSVODOptions()

    const base = {
      capLevelToPlayerSize: true,
      autoStartLoad: false,

      loader: new this.p2pMediaLoaderModule.Engine(p2pMediaLoaderConfig).createLoaderClass(),

      ...specificLiveOrVODOptions
    }

    const averageBandwidth = getAverageBandwidthInStore()
    if (!averageBandwidth) return base

    return {
      ...base,

      abrEwmaDefaultEstimate: averageBandwidth * 8, // We want bit/s
      startLevel: -1,
      testBandwidth: false,
      debug: false
    }
  }

  private getHLSLiveOptions () {
    const latencyMode = this.options.common.liveOptions.latencyMode

    switch (latencyMode) {
      case LiveVideoLatencyMode.SMALL_LATENCY:
        return {
          liveSyncDurationCount: 2
        }

      case LiveVideoLatencyMode.HIGH_LATENCY:
        return {
          liveSyncDurationCount: 10
        }

      default:
        return {
          liveSyncDurationCount: 5
        }
    }
  }

  private getHLSVODOptions () {
    return {
      liveSyncDurationCount: 5
    }
  }

  private addWebTorrentOptions (plugins: VideoJSPluginOptions, alreadyPlayed: boolean) {
    const commonOptions = this.options.common
    const webtorrentOptions = this.options.webtorrent
    const p2pMediaLoaderOptions = this.options.p2pMediaLoader

    const autoplay = this.getAutoPlayValue(commonOptions.autoplay, alreadyPlayed) === 'play'

    const webtorrent = {
      autoplay,

      playerRefusedP2P: commonOptions.p2pEnabled === false,
      videoDuration: commonOptions.videoDuration,
      playerElement: commonOptions.playerElement,

      videoFiles: webtorrentOptions.videoFiles.length !== 0
        ? webtorrentOptions.videoFiles
        // The WebTorrent plugin won't be able to play these files, but it will fallback to HTTP mode
        : p2pMediaLoaderOptions?.videoFiles || [],

      startTime: commonOptions.startTime
    }

    Object.assign(plugins, { webtorrent })
  }

  private getControlBarChildren (mode: PlayerMode, options: {
    p2pEnabled: boolean
    videoShortUUID: string

    peertubeLink: boolean
    theaterButton: boolean
    captions: boolean

    nextVideo?: () => void
    hasNextVideo?: () => boolean

    previousVideo?: () => void
    hasPreviousVideo?: () => boolean
  }) {
    const settingEntries = []
    const loadProgressBar = mode === 'webtorrent' ? 'peerTubeLoadProgressBar' : 'loadProgressBar'

    // Keep an order
    settingEntries.push('playbackRateMenuButton')
    if (options.captions === true) settingEntries.push('captionsButton')
    settingEntries.push('resolutionMenuButton')

    const children = {}

    if (options.previousVideo) {
      const buttonOptions: NextPreviousVideoButtonOptions = {
        type: 'previous',
        handler: options.previousVideo,
        isDisabled: () => {
          if (!options.hasPreviousVideo) return false

          return !options.hasPreviousVideo()
        }
      }

      Object.assign(children, {
        previousVideoButton: buttonOptions
      })
    }

    Object.assign(children, { playToggle: {} })

    if (options.nextVideo) {
      const buttonOptions: NextPreviousVideoButtonOptions = {
        type: 'next',
        handler: options.nextVideo,
        isDisabled: () => {
          if (!options.hasNextVideo) return false

          return !options.hasNextVideo()
        }
      }

      Object.assign(children, {
        nextVideoButton: buttonOptions
      })
    }

    Object.assign(children, {
      currentTimeDisplay: {},
      timeDivider: {},
      durationDisplay: {},
      liveDisplay: {},

      flexibleWidthSpacer: {},
      progressControl: {
        children: {
          seekBar: {
            children: {
              [loadProgressBar]: {},
              mouseTimeDisplay: {},
              playProgressBar: {}
            }
          }
        }
      },

      p2PInfoButton: {
        p2pEnabled: options.p2pEnabled
      },

      muteToggle: {},
      volumeControl: {},

      settingsButton: {
        setup: {
          maxHeightOffset: 40
        },
        entries: settingEntries
      }
    })

    if (options.peertubeLink === true) {
      Object.assign(children, {
        peerTubeLinkButton: { shortUUID: options.videoShortUUID } as PeerTubeLinkButtonOptions
      })
    }

    if (options.theaterButton === true) {
      Object.assign(children, {
        theaterButton: {}
      })
    }

    Object.assign(children, {
      fullscreenToggle: {}
    })

    return children
  }

  private getAutoPlayValue (autoplay: any, alreadyPlayed: boolean) {
    if (autoplay !== true) return autoplay

    // On first play, disable autoplay to avoid issues
    // But if the player already played videos, we can safely autoplay next ones
    if (isIOS() || isSafari()) {
      return alreadyPlayed ? 'play' : false
    }

    return 'play'
  }

  getContextMenuOptions (player: videojs.Player, commonOptions: CommonOptions) {
    const content = () => {
      const isLoopEnabled = player.options_['loop']

      const items = [
        {
          icon: 'repeat',
          label: player.localize('Play in loop') + (isLoopEnabled ? '<span class="vjs-icon-tick-white"></span>' : ''),
          listener: function () {
            player.options_['loop'] = !isLoopEnabled
          }
        },
        {
          label: player.localize('Copy the video URL'),
          listener: function () {
            copyToClipboard(buildVideoLink({ shortUUID: commonOptions.videoShortUUID }))
          }
        },
        {
          label: player.localize('Copy the video URL at the current time'),
          listener: function (this: videojs.Player) {
            const url = buildVideoLink({ shortUUID: commonOptions.videoShortUUID })

            copyToClipboard(decorateVideoLink({ url, startTime: this.currentTime() }))
          }
        },
        {
          icon: 'code',
          label: player.localize('Copy embed code'),
          listener: () => {
            copyToClipboard(buildVideoOrPlaylistEmbed(commonOptions.embedUrl, commonOptions.embedTitle))
          }
        }
      ]

      if (this.mode === 'webtorrent') {
        items.push({
          label: player.localize('Copy magnet URI'),
          listener: function (this: videojs.Player) {
            copyToClipboard(this.webtorrent().getCurrentVideoFile().magnetUri)
          }
        })
      }

      items.push({
        icon: 'info',
        label: player.localize('Stats for nerds'),
        listener: () => {
          player.stats().show()
        }
      })

      return items.map(i => ({
        ...i,
        label: `<span class="vjs-icon-${i.icon || 'link-2'}"></span>` + i.label
      }))
    }

    return { content }
  }
}
