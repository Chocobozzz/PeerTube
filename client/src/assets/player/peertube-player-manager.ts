import 'videojs-hotkeys/videojs.hotkeys'
import 'videojs-dock'
import 'videojs-contextmenu-pt'
import 'videojs-contrib-quality-levels'
import './upnext/end-card'
import './upnext/upnext-plugin'
import './stats/stats-card'
import './stats/stats-plugin'
import './bezels/bezels-plugin'
import './peertube-plugin'
import './videojs-components/next-previous-video-button'
import './videojs-components/p2p-info-button'
import './videojs-components/peertube-link-button'
import './videojs-components/peertube-load-progress-bar'
import './videojs-components/resolution-menu-button'
import './videojs-components/resolution-menu-item'
import './videojs-components/settings-dialog'
import './videojs-components/settings-menu-button'
import './videojs-components/settings-menu-item'
import './videojs-components/settings-panel'
import './videojs-components/settings-panel-child'
import './videojs-components/theater-button'
import './playlist/playlist-plugin'
import videojs from 'video.js'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { isDefaultLocale } from '@shared/core-utils/i18n'
import { VideoFile } from '@shared/models'
import { copyToClipboard } from '../../root-helpers/utils'
import { RedundancyUrlManager } from './p2p-media-loader/redundancy-url-manager'
import { segmentUrlBuilderFactory } from './p2p-media-loader/segment-url-builder'
import { segmentValidatorFactory } from './p2p-media-loader/segment-validator'
import { getStoredP2PEnabled } from './peertube-player-local-storage'
import {
  NextPreviousVideoButtonOptions,
  P2PMediaLoaderPluginOptions,
  PlaylistPluginOptions,
  UserWatching,
  VideoJSCaption,
  VideoJSPluginOptions
} from './peertube-videojs-typings'
import { TranslationsManager } from './translations-manager'
import { buildVideoLink, buildVideoOrPlaylistEmbed, getRtcConfig, isIOS, isSafari } from './utils'

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
(videojs.getComponent('PlaybackRateMenuButton') as any).prototype.controlText_ = 'Speed'

const CaptionsButton = videojs.getComponent('CaptionsButton') as any
// Change Captions to Subtitles/CC
CaptionsButton.prototype.controlText_ = 'Subtitles/CC'
// We just want to display 'Off' instead of 'captions off', keep a space so the variable == true (hacky I know)
CaptionsButton.prototype.label_ = ' '

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

  language?: string

  videoCaptions: VideoJSCaption[]

  videoUUID: string

  userWatching?: UserWatching

  serverUrl: string
}

export type PeertubePlayerManagerOptions = {
  common: CommonOptions
  webtorrent: WebtorrentOptions
  p2pMediaLoader?: P2PMediaLoaderOptions

  pluginsManager: PluginsManager
}

export class PeertubePlayerManager {
  private static playerElementClassName: string
  private static onPlayerChange: (player: videojs.Player) => void
  private static alreadyPlayed = false
  private static pluginsManager: PluginsManager

  static initState () {
    PeertubePlayerManager.alreadyPlayed = false
  }

  static async initialize (mode: PlayerMode, options: PeertubePlayerManagerOptions, onPlayerChange: (player: videojs.Player) => void) {
    this.pluginsManager = options.pluginsManager

    let p2pMediaLoader: any

    this.onPlayerChange = onPlayerChange
    this.playerElementClassName = options.common.playerElement.className

    if (mode === 'webtorrent') await import('./webtorrent/webtorrent-plugin')
    if (mode === 'p2p-media-loader') {
      [ p2pMediaLoader ] = await Promise.all([
        import('p2p-media-loader-hlsjs'),
        import('./p2p-media-loader/p2p-media-loader-plugin')
      ])
    }

    const videojsOptions = await this.getVideojsOptions(mode, options, p2pMediaLoader)

    await TranslationsManager.loadLocaleInVideoJS(options.common.serverUrl, options.common.language, videojs)

    const self = this
    return new Promise(res => {
      videojs(options.common.playerElement, videojsOptions, function (this: videojs.Player) {
        const player = this

        let alreadyFallback = false

        player.tech(true).one('error', () => {
          if (!alreadyFallback) self.maybeFallbackToWebTorrent(mode, player, options)
          alreadyFallback = true
        })

        player.one('error', () => {
          if (!alreadyFallback) self.maybeFallbackToWebTorrent(mode, player, options)
          alreadyFallback = true
        })

        player.one('play', () => {
          PeertubePlayerManager.alreadyPlayed = true
        })

        self.addContextMenu(mode, player, options.common.embedUrl, options.common.embedTitle)

        player.bezels()
        player.stats({
          videoUUID: options.common.videoUUID,
          videoIsLive: options.common.isLive,
          mode
        })

        return res(player)
      })
    })
  }

  private static async maybeFallbackToWebTorrent (currentMode: PlayerMode, player: any, options: PeertubePlayerManagerOptions) {
    if (currentMode === 'webtorrent') return

    console.log('Fallback to webtorrent.')

    const newVideoElement = document.createElement('video')
    newVideoElement.className = this.playerElementClassName

    // VideoJS wraps our video element inside a div
    let currentParentPlayerElement = options.common.playerElement.parentNode
    // Fix on IOS, don't ask me why
    if (!currentParentPlayerElement) currentParentPlayerElement = document.getElementById(options.common.playerElement.id).parentNode

    currentParentPlayerElement.parentNode.insertBefore(newVideoElement, currentParentPlayerElement)

    options.common.playerElement = newVideoElement
    options.common.onPlayerElementChange(newVideoElement)

    player.dispose()

    await import('./webtorrent/webtorrent-plugin')

    const mode = 'webtorrent'
    const videojsOptions = await this.getVideojsOptions(mode, options)

    const self = this
    videojs(newVideoElement, videojsOptions, function (this: videojs.Player) {
      const player = this

      self.addContextMenu(mode, player, options.common.embedUrl, options.common.embedTitle)

      PeertubePlayerManager.onPlayerChange(player)
    })
  }

  private static async getVideojsOptions (
    mode: PlayerMode,
    options: PeertubePlayerManagerOptions,
    p2pMediaLoaderModule?: any
  ): Promise<videojs.PlayerOptions> {
    const commonOptions = options.common
    const isHLS = mode === 'p2p-media-loader'

    let autoplay = this.getAutoPlayValue(commonOptions.autoplay)
    const html5 = {
      preloadTextTracks: false
    }

    const plugins: VideoJSPluginOptions = {
      peertube: {
        mode,
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

    if (commonOptions.enableHotkeys === true) {
      PeertubePlayerManager.addHotkeysOptions(plugins)
    }

    if (isHLS) {
      const { hlsjs } = PeertubePlayerManager.addP2PMediaLoaderOptions(plugins, options, p2pMediaLoaderModule)

      Object.assign(html5, hlsjs.html5)
    }

    if (mode === 'webtorrent') {
      PeertubePlayerManager.addWebTorrentOptions(plugins, options)

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

      autoplay: this.getAutoPlayValue(autoplay),

      poster: commonOptions.poster,
      inactivityTimeout: commonOptions.inactivityTimeout,
      playbackRates: [ 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ],

      plugins,

      controlBar: {
        children: this.getControlBarChildren(mode, {
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

    return this.pluginsManager.runHook('filter:internal.player.videojs.options.result', videojsOptions)
  }

  private static addP2PMediaLoaderOptions (
    plugins: VideoJSPluginOptions,
    options: PeertubePlayerManagerOptions,
    p2pMediaLoaderModule: any
  ) {
    const p2pMediaLoaderOptions = options.p2pMediaLoader
    const commonOptions = options.common

    const trackerAnnounce = p2pMediaLoaderOptions.trackerAnnounce
                                                 .filter(t => t.startsWith('ws'))

    const redundancyUrlManager = new RedundancyUrlManager(options.p2pMediaLoader.redundancyBaseUrls)

    const p2pMediaLoader: P2PMediaLoaderPluginOptions = {
      redundancyUrlManager,
      type: 'application/x-mpegURL',
      startTime: commonOptions.startTime,
      src: p2pMediaLoaderOptions.playlistUrl
    }

    let consumeOnly = false
    // FIXME: typings
    if (navigator && (navigator as any).connection && (navigator as any).connection.type === 'cellular') {
      console.log('We are on a cellular connection: disabling seeding.')
      consumeOnly = true
    }

    const p2pMediaLoaderConfig = {
      loader: {
        trackerAnnounce,
        segmentValidator: segmentValidatorFactory(options.p2pMediaLoader.segmentsSha256Url, options.common.isLive),
        rtcConfig: getRtcConfig(),
        requiredSegmentsPriority: 1,
        segmentUrlBuilder: segmentUrlBuilderFactory(redundancyUrlManager),
        useP2P: getStoredP2PEnabled(),
        consumeOnly
      },
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
        hlsjsConfig: {
          capLevelToPlayerSize: true,
          autoStartLoad: false,
          liveSyncDurationCount: 5,
          loader: new p2pMediaLoaderModule.Engine(p2pMediaLoaderConfig).createLoaderClass()
        }
      }
    }

    const toAssign = { p2pMediaLoader, hlsjs }
    Object.assign(plugins, toAssign)

    return toAssign
  }

  private static addWebTorrentOptions (plugins: VideoJSPluginOptions, options: PeertubePlayerManagerOptions) {
    const commonOptions = options.common
    const webtorrentOptions = options.webtorrent
    const p2pMediaLoaderOptions = options.p2pMediaLoader

    const autoplay = this.getAutoPlayValue(commonOptions.autoplay) === 'play'
      ? true
      : false

    const webtorrent = {
      autoplay,
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

  private static getControlBarChildren (mode: PlayerMode, options: {
    peertubeLink: boolean
    theaterButton: boolean
    captions: boolean

    nextVideo?: Function
    hasNextVideo?: () => boolean

    previousVideo?: Function
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
        'previousVideoButton': buttonOptions
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
        'nextVideoButton': buttonOptions
      })
    }

    Object.assign(children, {
      'currentTimeDisplay': {},
      'timeDivider': {},
      'durationDisplay': {},
      'liveDisplay': {},

      'flexibleWidthSpacer': {},
      'progressControl': {
        children: {
          'seekBar': {
            children: {
              [loadProgressBar]: {},
              'mouseTimeDisplay': {},
              'playProgressBar': {}
            }
          }
        }
      },

      'p2PInfoButton': {},

      'muteToggle': {},
      'volumeControl': {},

      'settingsButton': {
        setup: {
          maxHeightOffset: 40
        },
        entries: settingEntries
      }
    })

    if (options.peertubeLink === true) {
      Object.assign(children, {
        'peerTubeLinkButton': {}
      })
    }

    if (options.theaterButton === true) {
      Object.assign(children, {
        'theaterButton': {}
      })
    }

    Object.assign(children, {
      'fullscreenToggle': {}
    })

    return children
  }

  private static addContextMenu (mode: PlayerMode, player: videojs.Player, videoEmbedUrl: string, videoEmbedTitle: string) {
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
            copyToClipboard(buildVideoLink())
          }
        },
        {
          label: player.localize('Copy the video URL at the current time'),
          listener: function (this: videojs.Player) {
            copyToClipboard(buildVideoLink({ startTime: this.currentTime() }))
          }
        },
        {
          icon: 'code',
          label: player.localize('Copy embed code'),
          listener: () => {
            copyToClipboard(buildVideoOrPlaylistEmbed(videoEmbedUrl, videoEmbedTitle))
          }
        }
      ]

      if (mode === 'webtorrent') {
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

    // adding the menu
    player.contextmenuUI({ content })
  }

  private static addHotkeysOptions (plugins: VideoJSPluginOptions) {
    const isNaked = (event: KeyboardEvent, key: string) =>
      (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === key)

    Object.assign(plugins, {
      hotkeys: {
        skipInitialFocus: true,
        enableInactiveFocus: false,
        captureDocumentHotkeys: true,
        documentHotkeysFocusElementFilter: (e: HTMLElement) => {
          const tagName = e.tagName.toLowerCase()
          return e.id === 'content' || tagName === 'body' || tagName === 'video'
        },

        enableVolumeScroll: false,
        enableModifiersForNumbers: false,

        rewindKey: function (event: KeyboardEvent) {
          return isNaked(event, 'ArrowLeft')
        },

        forwardKey: function (event: KeyboardEvent) {
          return isNaked(event, 'ArrowRight')
        },

        fullscreenKey: function (event: KeyboardEvent) {
          // fullscreen with the f key or Ctrl+Enter
          return isNaked(event, 'f') || (!event.altKey && event.ctrlKey && event.key === 'Enter')
        },

        customKeys: {
          increasePlaybackRateKey: {
            key: function (event: KeyboardEvent) {
              return isNaked(event, '>')
            },
            handler: function (player: videojs.Player) {
              const newValue = Math.min(player.playbackRate() + 0.1, 5)
              player.playbackRate(parseFloat(newValue.toFixed(2)))
            }
          },
          decreasePlaybackRateKey: {
            key: function (event: KeyboardEvent) {
              return isNaked(event, '<')
            },
            handler: function (player: videojs.Player) {
              const newValue = Math.max(player.playbackRate() - 0.1, 0.10)
              player.playbackRate(parseFloat(newValue.toFixed(2)))
            }
          },
          frameByFrame: {
            key: function (event: KeyboardEvent) {
              return isNaked(event, '.')
            },
            handler: function (player: videojs.Player) {
              player.pause()
              // Calculate movement distance (assuming 30 fps)
              const dist = 1 / 30
              player.currentTime(player.currentTime() + dist)
            }
          }
        }
      }
    })
  }

  private static getAutoPlayValue (autoplay: any) {
    if (autoplay !== true) return autoplay

    // On first play, disable autoplay to avoid issues
    // But if the player already played videos, we can safely autoplay next ones
    if (isIOS() || isSafari()) {
      return PeertubePlayerManager.alreadyPlayed ? 'play' : false
    }

    return 'play'
  }
}

// ############################################################################

export {
  videojs
}
