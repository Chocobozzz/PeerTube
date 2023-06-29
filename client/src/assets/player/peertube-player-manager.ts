import '@peertube/videojs-contextmenu'
import './shared/upnext/end-card'
import './shared/upnext/upnext-plugin'
import './shared/stats/stats-card'
import './shared/stats/stats-plugin'
import './shared/bezels/bezels-plugin'
import './shared/peertube/peertube-plugin'
import './shared/resolutions/peertube-resolutions-plugin'
import './shared/control-bar/storyboard-plugin'
import './shared/control-bar/next-previous-video-button'
import './shared/control-bar/p2p-info-button'
import './shared/control-bar/peertube-link-button'
import './shared/control-bar/peertube-load-progress-bar'
import './shared/control-bar/theater-button'
import './shared/control-bar/peertube-live-display'
import './shared/settings/resolution-menu-button'
import './shared/settings/resolution-menu-item'
import './shared/settings/settings-dialog'
import './shared/settings/settings-menu-button'
import './shared/settings/settings-menu-item'
import './shared/settings/settings-panel'
import './shared/settings/settings-panel-child'
import './shared/playlist/playlist-plugin'
import './shared/mobile/peertube-mobile-plugin'
import './shared/mobile/peertube-mobile-buttons'
import './shared/hotkeys/peertube-hotkeys-plugin'
import './shared/metrics/metrics-plugin'
import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { isMobile } from '@root-helpers/web-browser'
import { saveAverageBandwidth } from './peertube-player-local-storage'
import { ManagerOptionsBuilder } from './shared/manager-options'
import { TranslationsManager } from './translations-manager'
import { CommonOptions, PeertubePlayerManagerOptions, PlayerMode, PlayerNetworkInfo } from './types'

// Change 'Playback Rate' to 'Speed' (smaller for our settings menu)
(videojs.getComponent('PlaybackRateMenuButton') as any).prototype.controlText_ = 'Speed'

const CaptionsButton = videojs.getComponent('CaptionsButton') as any
// Change Captions to Subtitles/CC
CaptionsButton.prototype.controlText_ = 'Subtitles/CC'
// We just want to display 'Off' instead of 'captions off', keep a space so the variable == true (hacky I know)
CaptionsButton.prototype.label_ = ' '

// TODO: remove when https://github.com/videojs/video.js/pull/7598 is merged
const PlayProgressBar = videojs.getComponent('PlayProgressBar') as any
if (PlayProgressBar.prototype.options_.children.includes('timeTooltip') !== true) {
  PlayProgressBar.prototype.options_.children.push('timeTooltip')
}

export class PeertubePlayerManager {
  private static playerElementClassName: string
  private static playerElementAttributes: { name: string, value: string }[] = []

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

    for (const name of options.common.playerElement.getAttributeNames()) {
      this.playerElementAttributes.push({ name, value: options.common.playerElement.getAttribute(name) })
    }

    if (mode === 'webtorrent') await import('./shared/webtorrent/webtorrent-plugin')
    if (mode === 'p2p-media-loader') {
      const [ p2pMediaLoaderModule ] = await Promise.all([
        import('@peertube/p2p-media-loader-hlsjs'),
        import('./shared/p2p-media-loader/p2p-media-loader-plugin')
      ])

      this.p2pMediaLoaderModule = p2pMediaLoaderModule
    }

    await TranslationsManager.loadLocaleInVideoJS(options.common.serverUrl, options.common.language, videojs)

    return this.buildPlayer(mode, options)
  }

  private static async buildPlayer (mode: PlayerMode, options: PeertubePlayerManagerOptions): Promise<videojs.Player> {
    const videojsOptionsBuilder = new ManagerOptionsBuilder(mode, options, this.p2pMediaLoaderModule)

    const videojsOptions = await this.pluginsManager.runHook(
      'filter:internal.player.videojs.options.result',
      videojsOptionsBuilder.getVideojsOptions(this.alreadyPlayed)
    )

    const self = this
    return new Promise(res => {
      videojs(options.common.playerElement, videojsOptions, function (this: videojs.Player) {
        const player = this

        if (!isNaN(+options.common.playbackRate)) {
          player.playbackRate(+options.common.playbackRate)
        }

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
        if (options.common.enableHotkeys === true) player.peerTubeHotkeysPlugin({ isLive: options.common.isLive })
        if (options.common.controlBar === false) player.controlBar.addClass('control-bar-hidden')

        player.bezels()

        player.stats({
          videoUUID: options.common.videoUUID,
          videoIsLive: options.common.isLive,
          mode,
          p2pEnabled: options.common.p2pEnabled
        })

        if (options.common.storyboard) {
          player.storyboard(options.common.storyboard)
        }

        player.on('p2pInfo', (_, data: PlayerNetworkInfo) => {
          if (data.source !== 'p2p-media-loader' || isNaN(data.bandwidthEstimate)) return

          saveAverageBandwidth(data.bandwidthEstimate)
        })

        const offlineNotificationElem = document.createElement('div')
        offlineNotificationElem.classList.add('vjs-peertube-offline-notification')
        offlineNotificationElem.innerText = player.localize('You seem to be offline and the video may not work')

        let offlineNotificationElemAdded = false

        const handleOnline = () => {
          if (!offlineNotificationElemAdded) return

          player.el().removeChild(offlineNotificationElem)
          offlineNotificationElemAdded = false

          logger.info('The browser is online')
        }

        const handleOffline = () => {
          if (offlineNotificationElemAdded) return

          player.el().appendChild(offlineNotificationElem)
          offlineNotificationElemAdded = true

          logger.info('The browser is offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        player.on('dispose', () => {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
        })

        return res(player)
      })
    })
  }

  private static async tryToRecoverHLSError (err: any, currentPlayer: videojs.Player, options: PeertubePlayerManagerOptions) {
    if (err.code === MediaError.MEDIA_ERR_DECODE) {

      // Display a notification to user
      if (this.videojsDecodeErrors === 0) {
        options.common.errorNotifier(currentPlayer.localize('The video failed to play, will try to fast forward.'))
      }

      if (this.videojsDecodeErrors === 20) {
        this.maybeFallbackToWebTorrent('p2p-media-loader', currentPlayer, options)
        return
      }

      logger.info('Fast forwarding HLS to recover from an error.')

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

    logger.info('Fallback to webtorrent.')

    this.rebuildAndUpdateVideoElement(currentPlayer, options.common)

    await import('./shared/webtorrent/webtorrent-plugin')

    const newPlayer = await this.buildPlayer('webtorrent', options)
    this.onPlayerChange(newPlayer)
  }

  private static rebuildAndUpdateVideoElement (player: videojs.Player, commonOptions: CommonOptions) {
    const newVideoElement = document.createElement('video')

    // Reset class
    newVideoElement.className = this.playerElementClassName

    // Reapply attributes
    for (const { name, value } of this.playerElementAttributes) {
      newVideoElement.setAttribute(name, value)
    }

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

  private static addContextMenu (optionsBuilder: ManagerOptionsBuilder, player: videojs.Player, commonOptions: CommonOptions) {
    const options = optionsBuilder.getContextMenuOptions(player, commonOptions)

    player.contextmenuUI(options)
  }
}

// ############################################################################

export {
  videojs
}
