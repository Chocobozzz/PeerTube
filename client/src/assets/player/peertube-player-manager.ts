import 'videojs-dock'
import '@peertube/videojs-contextmenu'
import './upnext/end-card'
import './upnext/upnext-plugin'
import './stats/stats-card'
import './stats/stats-plugin'
import './bezels/bezels-plugin'
import './peertube-plugin'
import './peertube-resolutions-plugin'
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
import './mobile/peertube-mobile-plugin'
import './mobile/peertube-mobile-buttons'
import './hotkeys/peertube-hotkeys-plugin'
import videojs from 'video.js'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { saveAverageBandwidth } from './peertube-player-local-storage'
import { CommonOptions, PeertubePlayerManagerOptions, PeertubePlayerOptionsBuilder, PlayerMode } from './peertube-player-options-builder'
import { PlayerNetworkInfo } from './peertube-videojs-typings'
import { TranslationsManager } from './translations-manager'
import { isMobile } from './utils'

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
(videojs.getComponent('PlaybackRateMenuButton') as any).prototype.controlText_ = 'Speed'

const CaptionsButton = videojs.getComponent('CaptionsButton') as any
// Change Captions to Subtitles/CC
CaptionsButton.prototype.controlText_ = 'Subtitles/CC'
// We just want to display 'Off' instead of 'captions off', keep a space so the variable == true (hacky I know)
CaptionsButton.prototype.label_ = ' '

export class PeertubePlayerManager {
  private static playerElementClassName: string
  private static onPlayerChange: (player: videojs.Player) => void
  private static alreadyPlayed = false
  private static pluginsManager: PluginsManager

  private static videojsDecodeErrors = 0

  private static p2pMediaLoaderModule: any

  static initState () {
    this.alreadyPlayed = false
  }

  static async initialize (mode: PlayerMode, options: PeertubePlayerManagerOptions, onPlayerChange: (player: videojs.Player) => void) {
    this.pluginsManager = options.pluginsManager

    this.onPlayerChange = onPlayerChange
    this.playerElementClassName = options.common.playerElement.className

    if (mode === 'webtorrent') await import('./webtorrent/webtorrent-plugin')
    if (mode === 'p2p-media-loader') {
      const [ p2pMediaLoaderModule ] = await Promise.all([
        import('@peertube/p2p-media-loader-hlsjs'),
        import('./p2p-media-loader/p2p-media-loader-plugin')
      ])

      this.p2pMediaLoaderModule = p2pMediaLoaderModule
    }

    await TranslationsManager.loadLocaleInVideoJS(options.common.serverUrl, options.common.language, videojs)

    return this.buildPlayer(mode, options)
  }

  private static async buildPlayer (mode: PlayerMode, options: PeertubePlayerManagerOptions): Promise<videojs.Player> {
    const videojsOptionsBuilder = new PeertubePlayerOptionsBuilder(mode, options, this.p2pMediaLoaderModule)

    const videojsOptions = await this.pluginsManager.runHook(
      'filter:internal.player.videojs.options.result',
      videojsOptionsBuilder.getVideojsOptions(this.alreadyPlayed)
    )

    const self = this
    return new Promise(res => {
      videojs(options.common.playerElement, videojsOptions, function (this: videojs.Player) {
        const player = this

        let alreadyFallback = false

        const handleError = () => {
          if (alreadyFallback) return
          alreadyFallback = true

          if (mode === 'p2p-media-loader') {
            self.tryToRecoverHLSError(player.error(), player, options)
          } else {
            self.maybeFallbackToWebTorrent(mode, player, options)
          }
        }

        player.one('error', () => handleError())

        player.one('play', () => {
          self.alreadyPlayed = true
        })

        self.addContextMenu(videojsOptionsBuilder, player, options.common)

        if (isMobile()) player.peertubeMobile()
        if (options.common.enableHotkeys === true) player.peerTubeHotkeysPlugin()

        player.bezels()

        player.stats({
          videoUUID: options.common.videoUUID,
          videoIsLive: options.common.isLive,
          mode,
          p2pEnabled: options.common.p2pEnabled
        })

        player.on('p2pInfo', (_, data: PlayerNetworkInfo) => {
          if (data.source !== 'p2p-media-loader' || isNaN(data.bandwidthEstimate)) return

          saveAverageBandwidth(data.bandwidthEstimate)
        })

        return res(player)
      })
    })
  }

  private static async tryToRecoverHLSError (err: any, currentPlayer: videojs.Player, options: PeertubePlayerManagerOptions) {
    if (err.code === 3) { // Decode error

      // Display a notification to user
      if (this.videojsDecodeErrors === 0) {
        options.common.errorNotifier(currentPlayer.localize('The video failed to play, will try to fast forward.'))
      }

      if (this.videojsDecodeErrors === 20) {
        this.maybeFallbackToWebTorrent('p2p-media-loader', currentPlayer, options)
        return
      }

      console.log('Fast forwarding HLS to recover from an error.')

      this.videojsDecodeErrors++

      options.common.startTime = currentPlayer.currentTime() + 2
      options.common.autoplay = true
      this.rebuildAndUpdateVideoElement(currentPlayer, options.common)

      const newPlayer = await this.buildPlayer('p2p-media-loader', options)
      this.onPlayerChange(newPlayer)
    } else {
      this.maybeFallbackToWebTorrent('p2p-media-loader', currentPlayer, options)
    }
  }

  private static async maybeFallbackToWebTorrent (
    currentMode: PlayerMode,
    currentPlayer: videojs.Player,
    options: PeertubePlayerManagerOptions
  ) {
    if (options.webtorrent.videoFiles.length === 0 || currentMode === 'webtorrent') {
      currentPlayer.peertube().displayFatalError()
      return
    }

    console.log('Fallback to webtorrent.')

    this.rebuildAndUpdateVideoElement(currentPlayer, options.common)

    await import('./webtorrent/webtorrent-plugin')

    const newPlayer = await this.buildPlayer('webtorrent', options)
    this.onPlayerChange(newPlayer)
  }

  private static rebuildAndUpdateVideoElement (player: videojs.Player, commonOptions: CommonOptions) {
    const newVideoElement = document.createElement('video')
    newVideoElement.className = this.playerElementClassName

    // VideoJS wraps our video element inside a div
    let currentParentPlayerElement = commonOptions.playerElement.parentNode
    // Fix on IOS, don't ask me why
    if (!currentParentPlayerElement) currentParentPlayerElement = document.getElementById(commonOptions.playerElement.id).parentNode

    currentParentPlayerElement.parentNode.insertBefore(newVideoElement, currentParentPlayerElement)

    commonOptions.playerElement = newVideoElement
    commonOptions.onPlayerElementChange(newVideoElement)

    player.dispose()

    return newVideoElement
  }

  private static addContextMenu (optionsBuilder: PeertubePlayerOptionsBuilder, player: videojs.Player, commonOptions: CommonOptions) {
    const options = optionsBuilder.getContextMenuOptions(player, commonOptions)

    player.contextmenuUI(options)
  }
}

// ############################################################################

export {
  videojs
}
