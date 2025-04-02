import './shared/context-menu'
import './shared/upnext/end-card'
import './shared/upnext/upnext-plugin'
import './shared/stats/stats-card'
import './shared/stats/stats-plugin'
import './shared/bezels/bezels-plugin'
import './shared/peertube/peertube-plugin'
import './shared/resolutions/peertube-resolutions-plugin'
import './shared/control-bar/caption-toggle-button'
import './shared/control-bar/storyboard-plugin'
import './shared/control-bar/chapters-plugin'
import './shared/control-bar/time-tooltip'
import './shared/control-bar/next-previous-video-button'
import './shared/control-bar/p2p-info-button'
import './shared/control-bar/peertube-link-button'
import './shared/control-bar/theater-button'
import './shared/control-bar/peertube-live-display'
import './shared/settings/menu-focus-fixed'
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
import './shared/p2p-media-loader/hls-plugin'
import './shared/p2p-media-loader/p2p-media-loader-plugin'
import './shared/web-video/web-video-plugin'
import './shared/dock/peertube-dock-component'
import './shared/dock/peertube-dock-plugin'
import videojs, { VideoJsPlayer } from 'video.js'
import { logger } from '@root-helpers/logger'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { copyToClipboard } from '@root-helpers/utils'
import { buildVideoOrPlaylistEmbed } from '@root-helpers/video'
import { isMobile } from '@root-helpers/web-browser'
import { buildVideoLink, decorateVideoLink, isDefaultLocale, pick } from '@peertube/peertube-core-utils'
import { saveAverageBandwidth } from './peertube-player-local-storage'
import { ControlBarOptionsBuilder, HLSOptionsBuilder, WebVideoOptionsBuilder } from './shared/player-options-builder'
import { TranslationsManager } from '@root-helpers/translations-manager'
import { PeerTubePlayerConstructorOptions, PeerTubePlayerLoadOptions, PlayerNetworkInfo, VideoJSPluginOptions } from './types'

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

export { videojs }

export class PeerTubePlayer {
  private pluginsManager: PluginsManager

  private videojsDecodeErrors = 0

  private player: VideoJsPlayer

  private currentLoadOptions: PeerTubePlayerLoadOptions

  constructor (private options: PeerTubePlayerConstructorOptions) {
    this.pluginsManager = options.pluginsManager
  }

  unload () {
    if (!this.player) return

    this.disposeDynamicPluginsIfNeeded()

    this.player.reset()
  }

  async load (loadOptions: PeerTubePlayerLoadOptions) {
    this.currentLoadOptions = loadOptions

    this.setPoster('')

    this.disposeDynamicPluginsIfNeeded()

    await this.buildPlayerIfNeeded()

    if (this.currentLoadOptions.mode === 'p2p-media-loader') {
      await this.loadP2PMediaLoader()
    } else {
      this.loadWebVideo()
    }

    this.loadDynamicPlugins()

    if (this.options.controlBar === false) this.player.controlBar.hide()
    else this.player.controlBar.show()

    this.player.autoplay(this.getAutoPlayValue(this.currentLoadOptions.autoplay))

    if (!this.player.autoplay()) {
      this.setPoster(loadOptions.poster)
    }

    this.player.trigger('video-change')
  }

  getPlayer () {
    return this.player
  }

  destroy () {
    if (this.player) this.player.dispose()
  }

  setPoster (url: string) {
    // Use HTML video element to display poster
    if (!this.player) {
      this.options.playerElement().poster = url
      return
    }

    // Prefer using player poster API
    this.player?.poster(url)
    this.options.playerElement().poster = ''
  }

  enable () {
    if (!this.player) return

    (this.player.el() as HTMLElement).style.pointerEvents = 'auto'
  }

  disable () {
    if (!this.player) return

    if (this.player.isFullscreen()) {
      this.player.exitFullscreen()
    }

    // Disable player
    this.player.hasStarted(false)
    this.player.removeClass('vjs-has-autoplay')
    this.player.bigPlayButton.hide();

    (this.player.el() as HTMLElement).style.pointerEvents = 'none'
  }

  setCurrentTime (currentTime: number) {
    if (this.player.paused()) {
      this.currentLoadOptions.startTime = currentTime

      this.player.play()
      return
    }

    this.player.currentTime(currentTime)
    this.player.userActive(true)
  }

  private async loadP2PMediaLoader () {
    const hlsOptionsBuilder = new HLSOptionsBuilder({
      ...pick(this.options, [ 'pluginsManager', 'serverUrl', 'authorizationHeader', 'stunServers' ]),
      ...pick(this.currentLoadOptions, [
        'videoPassword',
        'requiresUserAuth',
        'videoFileToken',
        'requiresPassword',
        'isLive',
        'p2pEnabled',
        'liveOptions',
        'hls'
      ])
    })

    const { hlsjs, p2pMediaLoader } = await hlsOptionsBuilder.getPluginOptions()

    this.player.hlsjs(hlsjs)
    this.player.p2pMediaLoader(p2pMediaLoader)
  }

  private loadWebVideo () {
    const webVideoOptionsBuilder = new WebVideoOptionsBuilder(pick(this.currentLoadOptions, [
      'videoFileToken',
      'webVideo',
      'hls'
    ]))

    this.player.webVideo(webVideoOptionsBuilder.getPluginOptions())
  }

  private async buildPlayerIfNeeded () {
    if (this.player) return

    await TranslationsManager.loadLocaleInVideoJS(this.options.serverUrl, this.options.language, videojs)

    const videojsOptions = await this.pluginsManager.runHook(
      'filter:internal.player.videojs.options.result',
      this.getVideojsOptions()
    )

    this.player = videojs(this.options.playerElement(), videojsOptions)

    this.player.ready(() => {
      if (!isNaN(+this.options.playbackRate)) {
        this.player.playbackRate(+this.options.playbackRate)
      }

      let alreadyFallback = false

      const handleError = () => {
        if (alreadyFallback) return
        alreadyFallback = true

        if (this.currentLoadOptions.mode === 'p2p-media-loader') {
          this.tryToRecoverHLSError(this.player.error())
        } else {
          this.maybeFallbackToWebVideo()
        }
      }

      this.player.on('video-change', () => alreadyFallback = false)
      this.player.on('error', () => handleError())

      this.player.on('network-info', (_, data: PlayerNetworkInfo) => {
        if (data.source !== 'p2p-media-loader' || isNaN(data.bandwidthEstimate)) return

        saveAverageBandwidth(data.bandwidthEstimate)
      })

      this.player.contextMenu(this.getContextMenuOptions())

      this.displayNotificationWhenOffline()
    })
  }

  private disposeDynamicPluginsIfNeeded () {
    if (!this.player) return

    if (this.player.usingPlugin('peertubeMobile')) this.player.peertubeMobile().dispose()
    if (this.player.usingPlugin('peerTubeHotkeysPlugin')) this.player.peerTubeHotkeysPlugin().dispose()
    if (this.player.usingPlugin('playlist')) this.player.playlist().dispose()
    if (this.player.usingPlugin('bezels')) this.player.bezels().dispose()
    if (this.player.usingPlugin('upnext')) this.player.upnext().dispose()
    if (this.player.usingPlugin('stats')) this.player.stats().dispose()
    if (this.player.usingPlugin('storyboard')) this.player.storyboard().dispose()
    if (this.player.usingPlugin('chapters')) this.player.chapters().dispose()

    if (this.player.usingPlugin('peertubeDock')) this.player.peertubeDock().dispose()

    if (this.player.usingPlugin('p2pMediaLoader')) this.player.p2pMediaLoader().dispose()
    if (this.player.usingPlugin('hlsjs')) this.player.hlsjs().dispose()

    if (this.player.usingPlugin('webVideo')) this.player.webVideo().dispose()
  }

  private loadDynamicPlugins () {
    if (isMobile()) this.player.peertubeMobile()

    this.player.bezels()

    this.player.stats({
      videoUUID: this.currentLoadOptions.videoUUID,
      videoIsLive: this.currentLoadOptions.isLive,
      mode: this.currentLoadOptions.mode,
      p2pEnabled: this.currentLoadOptions.p2pEnabled
    })

    if (this.options.enableHotkeys === true) {
      this.player.peerTubeHotkeysPlugin({ isLive: this.currentLoadOptions.isLive })
    }

    if (this.currentLoadOptions.playlist) {
      this.player.playlist(this.currentLoadOptions.playlist)
    }

    if (this.currentLoadOptions.upnext) {
      this.player.upnext({
        timeout: this.currentLoadOptions.upnext.timeout,

        getTitle: () => this.currentLoadOptions.nextVideo.getVideoTitle(),

        next: () => this.currentLoadOptions.nextVideo.handler(),
        isDisplayed: () => this.currentLoadOptions.nextVideo.enabled && this.currentLoadOptions.upnext.isEnabled(),

        isSuspended: () => this.currentLoadOptions.upnext.isSuspended(this.player)
      })
    }

    if (this.currentLoadOptions.storyboard) {
      this.player.storyboard(this.currentLoadOptions.storyboard)
    }

    if (this.currentLoadOptions.videoChapters) {
      this.player.chapters({ chapters: this.currentLoadOptions.videoChapters })
    }

    if (this.currentLoadOptions.dock) {
      this.player.peertubeDock(this.currentLoadOptions.dock)
    }
  }

  private async tryToRecoverHLSError (err: any) {
    if (err.code === MediaError.MEDIA_ERR_DECODE) {

      // Display a notification to user
      if (this.videojsDecodeErrors === 0) {
        this.options.errorNotifier(this.player.localize('The video failed to play, will try to fast forward.'))
      }

      if (this.videojsDecodeErrors === 20) {
        this.maybeFallbackToWebVideo()
        return
      }

      logger.info('Fast forwarding HLS to recover from an error.', {
        err,
        videoShortUUID: this.currentLoadOptions.videoShortUUID,
        currentTime: this.player.currentTime(),
        resolution: this.player.videoHeight()
      })

      this.videojsDecodeErrors++

      await this.load({
        ...this.currentLoadOptions,

        mode: 'p2p-media-loader',
        startTime: this.player.currentTime() + 2,
        autoplay: true
      })
    } else {
      this.maybeFallbackToWebVideo()
    }
  }

  private async maybeFallbackToWebVideo () {
    if (this.currentLoadOptions.mode === 'web-video') {
      this.player.peertube().displayFatalError()
      return
    }

    logger.info('Fallback to web-video.')

    await this.load({
      ...this.currentLoadOptions,

      mode: 'web-video',
      startTime: this.player.currentTime(),
      autoplay: true
    })
  }

  getVideojsOptions (): videojs.PlayerOptions {
    const html5 = {
      preloadTextTracks: false,
      // Prevent a bug on iOS where the text tracks added by peertube plugin are removed on play
      // See https://github.com/Chocobozzz/PeerTube/issues/6351
      nativeTextTracks: false
    }

    const plugins: VideoJSPluginOptions = {
      peertube: {
        hasAutoplay: () => this.getAutoPlayValue(this.currentLoadOptions.autoplay),

        videoViewUrl: () => this.currentLoadOptions.videoViewUrl,
        videoViewIntervalMs: this.options.videoViewIntervalMs,

        authorizationHeader: this.options.authorizationHeader,

        videoDuration: () => this.currentLoadOptions.duration,

        startTime: () => this.currentLoadOptions.startTime,
        stopTime: () => this.currentLoadOptions.stopTime,

        videoCaptions: () => this.currentLoadOptions.videoCaptions,
        isLive: () => this.currentLoadOptions.isLive,
        videoUUID: () => this.currentLoadOptions.videoUUID,
        subtitle: () => this.currentLoadOptions.subtitle,

        videoRatio: () => this.currentLoadOptions.videoRatio,

        poster: () => this.currentLoadOptions.poster,

        autoPlayerRatio: this.options.autoPlayerRatio
      },
      metrics: {
        mode: () => this.currentLoadOptions.mode,

        metricsUrl: () => this.options.metricsUrl,
        metricsInterval: () => this.options.metricsInterval,
        videoUUID: () => this.currentLoadOptions.videoUUID
      }
    }

    const controlBarOptionsBuilder = new ControlBarOptionsBuilder({
      ...this.options,

      videoShortUUID: () => this.currentLoadOptions.videoShortUUID,
      p2pEnabled: () => this.currentLoadOptions.p2pEnabled,

      nextVideo: () => this.currentLoadOptions.nextVideo,
      previousVideo: () => this.currentLoadOptions.previousVideo
    })

    const videojsOptions = {
      html5,

      // We don't use text track settings for now
      textTrackSettings: false as any, // FIXME: typings
      controls: this.options.controls !== undefined ? this.options.controls : true,
      loop: this.options.loop !== undefined ? this.options.loop : false,

      muted: this.options.muted !== undefined
        ? this.options.muted
        : undefined, // Undefined so the player knows it has to check the local storage

      autoplay: this.getAutoPlayValue(this.currentLoadOptions.autoplay),

      poster: this.currentLoadOptions.poster,
      inactivityTimeout: this.options.inactivityTimeout,
      playbackRates: [ 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ],

      plugins,

      controlBar: {
        children: controlBarOptionsBuilder.getChildrenOptions() as any // FIXME: typings
      },

      language: this.options.language && !isDefaultLocale(this.options.language)
        ? this.options.language
        : undefined
    }

    return videojsOptions
  }

  private getAutoPlayValue (autoplay: boolean): videojs.Autoplay {
    if (autoplay !== true) return false

    return this.currentLoadOptions.forceAutoplay
      ? 'any'
      : 'play'
  }

  private displayNotificationWhenOffline () {
    const offlineNotificationElem = document.createElement('div')
    offlineNotificationElem.classList.add('vjs-peertube-offline-notification')
    offlineNotificationElem.innerText = this.player.localize('You seem to be offline and the video may not work')

    let offlineNotificationElemAdded = false

    const handleOnline = () => {
      if (!offlineNotificationElemAdded) return

      this.player.el().removeChild(offlineNotificationElem)
      offlineNotificationElemAdded = false

      logger.info('The browser is online')
    }

    const handleOffline = () => {
      if (offlineNotificationElemAdded) return

      this.player.el().appendChild(offlineNotificationElem)
      offlineNotificationElemAdded = true

      logger.info('The browser is offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    this.player.on('dispose', () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    })
  }

  private getContextMenuOptions () {

    const content = () => {
      const self = this
      const player = this.player

      const shortUUID = self.currentLoadOptions.videoShortUUID
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
            copyToClipboard(buildVideoLink({ shortUUID }), player.el() as HTMLElement)
          }
        },
        {
          label: player.localize('Copy the video URL at the current time'),
          listener: function () {
            const url = buildVideoLink({ shortUUID })

            copyToClipboard(decorateVideoLink({ url, startTime: player.currentTime() }), player.el() as HTMLElement)
          }
        },
        {
          icon: 'code',
          label: player.localize('Copy embed code'),
          listener: () => {
            copyToClipboard(
              buildVideoOrPlaylistEmbed({ embedUrl: self.currentLoadOptions.embedUrl, embedTitle: self.currentLoadOptions.embedTitle }),
              player.el() as HTMLElement
            )
          }
        }
      ]

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
