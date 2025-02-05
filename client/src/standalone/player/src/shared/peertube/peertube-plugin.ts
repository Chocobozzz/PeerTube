import { timeToInt } from '@peertube/peertube-core-utils'
import { VideoView, VideoViewEvent } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { isIOS, isMobile, isSafari } from '@root-helpers/web-browser'
import debug from 'debug'
import videojs from 'video.js'
import {
  getPlayerSessionId,
  getStoredLastSubtitle,
  getStoredMute,
  getStoredVolume,
  saveLastSubtitle,
  saveMuteInStore,
  savePreferredSubtitle,
  saveVideoWatchHistory,
  saveVolumeInStore
} from '../../peertube-player-local-storage'
import { PeerTubePluginOptions } from '../../types'
import { SettingsButton } from '../settings/settings-menu-button'

const debugLogger = debug('peertube:player:peertube')

const Plugin = videojs.getPlugin('plugin')

class PeerTubePlugin extends Plugin {
  declare private readonly videoViewUrl: () => string
  declare private readonly authorizationHeader: () => string
  declare private readonly initialInactivityTimeout: number

  declare private readonly hasAutoplay: () => videojs.Autoplay

  declare private currentSubtitle: string
  declare private currentPlaybackRate: number

  declare private videoViewInterval: any

  declare private menuOpened: boolean
  declare private mouseInControlBar: boolean
  declare private mouseInSettings: boolean

  declare private errorModal: videojs.ModalDialog

  declare private hasInitialSeek: boolean

  declare private videoViewOnPlayHandler: (...args: any[]) => void
  declare private videoViewOnSeekedHandler: (...args: any[]) => void
  declare private videoViewOnEndedHandler: (...args: any[]) => void

  declare private stopTimeHandler: (...args: any[]) => void

  declare private resizeObserver: ResizeObserver

  constructor (player: videojs.Player, private readonly options: PeerTubePluginOptions) {
    super(player)

    this.menuOpened = false
    this.mouseInControlBar = false
    this.mouseInSettings = false
    this.hasInitialSeek = false

    this.videoViewUrl = options.videoViewUrl
    this.authorizationHeader = options.authorizationHeader
    this.hasAutoplay = options.hasAutoplay

    this.initialInactivityTimeout = this.player.options_.inactivityTimeout

    this.currentSubtitle = this.options.subtitle() || getStoredLastSubtitle()

    this.initializePlayer()
    this.initOnVideoChange()

    this.player.removeClass('vjs-can-play')

    this.deleteLegacyIndexedDB()

    this.player.on('autoplay-failure', () => {
      debugLogger('Autoplay failed')

      this.player.removeClass('vjs-has-autoplay')

      this.player.poster(options.poster())

      // Fix a bug on iOS/Safari where the big play button is not displayed when autoplay fails
      if (isIOS() || isSafari()) this.player.hasStarted(false)
    })

    this.player.on('ratechange', () => {
      this.currentPlaybackRate = this.player.playbackRate()

      this.player.defaultPlaybackRate(this.currentPlaybackRate)
    })

    this.player.one('canplay', () => {
      const playerOptions = this.player.options_

      const volume = getStoredVolume()
      if (volume !== undefined) this.player.volume(volume)

      const muted = playerOptions.muted !== undefined ? playerOptions.muted : getStoredMute()
      if (muted !== undefined) this.player.muted(muted)

      this.player.addClass('vjs-can-play')
    })

    this.player.ready(() => {

      this.player.on('volumechange', () => {
        saveVolumeInStore(this.player.volume())
        saveMuteInStore(this.player.muted())
      })

      this.player.textTracks().addEventListener('change', () => {
        const showing = this.player.textTracks().tracks_.find(t => {
          return t.kind === 'captions' && t.mode === 'showing'
        })

        if (!showing) {
          saveLastSubtitle('off')
          this.currentSubtitle = undefined
          return
        }

        if (this.currentSubtitle === showing.language) return

        this.currentSubtitle = showing.language
        saveLastSubtitle(showing.language)
        savePreferredSubtitle(showing.language)
      })

      this.player.on('video-change', () => {
        this.initOnVideoChange()

        this.hideFatalError()
      })

      this.updatePlayerSizeClasses()

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.updatePlayerSizeClasses()
        })

        this.resizeObserver.observe(this.player.el())
      }
    })

    this.player.on('resolution-change', (_: any, { resolution }: { resolution: number }) => {
      if (this.player.paused()) {
        this.player.on('play', () => this.adaptPosterForAudioOnly(resolution))
        return
      }

      this.adaptPosterForAudioOnly(resolution)
    })

    this.initOnRatioChange()
  }

  dispose () {
    if (this.videoViewInterval) clearInterval(this.videoViewInterval)
    if (this.resizeObserver) this.resizeObserver.disconnect()

    super.dispose()
  }

  onMenuOpened () {
    this.menuOpened = true
    this.alterInactivity()
  }

  onMenuClosed () {
    this.menuOpened = false
    this.alterInactivity()
  }

  displayFatalError () {
    // Already displayed an error
    if (this.errorModal) return

    debugLogger('Display fatal error')

    this.player.loadingSpinner.hide()

    const buildModal = (error: MediaError) => {
      const localize = this.player.localize.bind(this.player)

      const wrapper = document.createElement('div')
      const header = document.createElement('h1')
      header.innerText = localize('Failed to play video')
      wrapper.appendChild(header)
      const desc = document.createElement('div')
      desc.innerText = localize('The video failed to play due to technical issues.')
      wrapper.appendChild(desc)
      const details = document.createElement('p')
      details.classList.add('error-details')
      details.innerText = error.message
      wrapper.appendChild(details)

      return wrapper
    }

    this.errorModal = this.player.createModal(buildModal(this.player.error()), {
      temporary: true,
      uncloseable: true
    })
    this.errorModal.addClass('vjs-custom-error-display')

    this.player.addClass('vjs-error-display-enabled')

    // Google Bot may throw codecs, but it should not prevent indexing
    if (/googlebot/i.test(navigator.userAgent)) {
      console.error(this.player.error())
    } else {
      logger.error('Fatal error in player', this.player.error())
    }
  }

  hideFatalError () {
    if (!this.errorModal) return

    debugLogger('Hiding fatal error')

    this.player.removeClass('vjs-error-display-enabled')
    this.player.removeChild(this.errorModal)
    this.errorModal.close()
    this.errorModal = undefined

    if (this.player.loadingSpinner) {
      this.player.loadingSpinner.show()
    }
  }

  private initializePlayer () {
    if (isMobile()) this.player.addClass('vjs-is-mobile')

    this.initSmoothProgressBar()

    this.player.ready(() => {
      this.listenControlBarMouse()
    })

    this.listenFullScreenChange()
  }

  private initOnVideoChange () {
    if (this.hasAutoplay() !== false) this.player.addClass('vjs-has-autoplay')
    else this.player.removeClass('vjs-has-autoplay')

    if (this.currentPlaybackRate && this.currentPlaybackRate !== 1) {
      debugLogger('Setting playback rate to ' + this.currentPlaybackRate)

      this.player.playbackRate(this.currentPlaybackRate)
    }

    this.player.ready(() => {
      this.initCaptions()
      this.updateControlBar()
    })

    this.handleStartStopTime()
    this.runUserViewing()
  }

  private initOnRatioChange () {
    if (!this.options.autoPlayerRatio) return

    const defaultRatio = getComputedStyle(this.player.el()).getPropertyValue(this.options.autoPlayerRatio.cssRatioVariable)

    const tryToUpdateRatioFromOptions = () => {
      if (!this.options.videoRatio()) return

      this.adaptPlayerFromRatio({ ratio: this.options.videoRatio(), defaultRatio })
      this.updatePlayerSizeClasses()
    }

    tryToUpdateRatioFromOptions()

    this.player.on('video-change', () => tryToUpdateRatioFromOptions())

    this.player.on('video-ratio-changed', (_event, data: { ratio: number }) => {
      if (this.options.videoRatio()) return

      this.adaptPlayerFromRatio({ ratio: data.ratio, defaultRatio })
      this.updatePlayerSizeClasses()
    })
  }

  private adaptPlayerFromRatio (options: {
    ratio: number
    defaultRatio: string
  }) {
    const { ratio, defaultRatio } = options

    const el = this.player.el() as HTMLElement

    // In portrait screen mode, we allow player with bigger height size than width
    const portraitMode = getComputedStyle(el).getPropertyValue(this.options.autoPlayerRatio.cssPlayerPortraitModeVariable) === '1'

    const currentRatio = isNaN(ratio) || (!portraitMode && ratio < 1)
      ? defaultRatio
      : ratio

    el.style.setProperty('--player-ratio', currentRatio + '')
  }

  // ---------------------------------------------------------------------------

  private runUserViewing () {
    const startTime = timeToInt(this.options.startTime())

    let lastCurrentTime = startTime
    let lastViewEvent: VideoViewEvent
    let ended = false // player.ended() is too "slow", so store ended state manually

    this.disableUserViewing()

    this.videoViewOnPlayHandler = () => {
      debugLogger('Notify user is watching on play: ' + startTime)

      this.notifyUserIsWatching(startTime, lastViewEvent)
    }

    this.videoViewOnSeekedHandler = () => {
      // Bypass the first initial seek
      if (this.hasInitialSeek) {
        this.hasInitialSeek = false
        return
      }

      const currentTime = Math.floor(this.player.currentTime())
      if (currentTime === 0 && this.player.loop()) {
        debugLogger('Disabling viewing notification after first video loop.')
        this.disableUserViewing()
        return
      }

      const diff = currentTime - lastCurrentTime

      // Don't take into account small forwards
      if (diff > 0 && diff < 3) return

      debugLogger('Detected seek event for user watching')

      lastViewEvent = 'seek'
    }

    this.videoViewOnEndedHandler = () => {
      ended = true

      if (this.options.isLive()) return

      const currentTime = Math.floor(this.player.duration())
      lastCurrentTime = currentTime

      debugLogger('Notify user is watching on end: ' + currentTime)

      this.notifyUserIsWatching(currentTime, lastViewEvent)

      lastViewEvent = undefined
    }

    this.player.one('play', this.videoViewOnPlayHandler)
    this.player.on('seeked', this.videoViewOnSeekedHandler)
    this.player.one('ended', this.videoViewOnEndedHandler)

    this.videoViewInterval = setInterval(() => {
      if (ended) return

      const currentTime = Math.floor(this.player.currentTime())

      // No need to update
      if (currentTime === lastCurrentTime) return

      debugLogger('Notify user is watching: ' + currentTime)

      lastCurrentTime = currentTime

      this.notifyUserIsWatching(currentTime, lastViewEvent)
        .catch(err => logger.error('Cannot notify user is watching.', err))

      lastViewEvent = undefined
    }, this.options.videoViewIntervalMs)
  }

  private disableUserViewing () {
    if (this.videoViewInterval) {
      clearInterval(this.videoViewInterval)
      this.videoViewInterval = undefined
    }

    if (this.videoViewOnPlayHandler) {
      this.player.off('play', this.videoViewOnPlayHandler)
      this.videoViewOnPlayHandler = undefined
    }

    if (this.videoViewOnSeekedHandler) {
      this.player.off('seeked', this.videoViewOnSeekedHandler)
      this.videoViewOnSeekedHandler = undefined
    }

    if (this.videoViewOnEndedHandler) {
      this.player.off('ended', this.videoViewOnEndedHandler)
      this.videoViewOnEndedHandler = undefined
    }
  }

  private notifyUserIsWatching (currentTime: number, viewEvent: VideoViewEvent) {
    // Server won't save history, so save the video position in local storage
    if (!this.authorizationHeader()) {
      saveVideoWatchHistory(this.options.videoUUID(), currentTime)
    }

    if (!this.videoViewUrl()) return Promise.resolve(true)

    const sessionId = getPlayerSessionId()

    const body: VideoView = { currentTime, viewEvent, sessionId }

    const headers = new Headers({ 'Content-type': 'application/json; charset=UTF-8' })
    if (this.authorizationHeader()) headers.set('Authorization', this.authorizationHeader())

    return fetch(this.videoViewUrl(), { method: 'POST', body: JSON.stringify(body), headers })
  }

  // ---------------------------------------------------------------------------

  private adaptPosterForAudioOnly (resolution: number) {
    debugLogger('Check if we need to adapt player for audio only', resolution)

    if (resolution === 0) {
      this.player.audioPosterMode(true)
      this.player.poster(this.options.poster())
      return
    }

    this.player.audioPosterMode(false)
    this.player.poster('')
  }

  // ---------------------------------------------------------------------------

  private updatePlayerSizeClasses () {
    requestAnimationFrame(() => {
      if (!this.player) return

      debugLogger('Updating player size classes')

      const width = this.player.currentWidth()

      const breakpoints = [ 350, 570, 750 ]

      for (const breakpoint of breakpoints) {
        if (width <= breakpoint) {
          this.player.addClass('vjs-size-' + breakpoint)
        } else {
          this.player.removeClass('vjs-size-' + breakpoint)
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  private listenFullScreenChange () {
    this.player.on('fullscreenchange', () => {
      if (this.player.isFullscreen()) this.player.focus()
    })
  }

  private listenControlBarMouse () {
    const controlBar = this.player.controlBar
    const settingsButton: SettingsButton = (controlBar as any).settingsButton

    controlBar.on('mouseenter', () => {
      this.mouseInControlBar = true
      this.alterInactivity()
    })

    controlBar.on('mouseleave', () => {
      this.mouseInControlBar = false
      this.alterInactivity()
    })

    settingsButton.dialog.on('mouseenter', () => {
      this.mouseInSettings = true
      this.alterInactivity()
    })

    settingsButton.dialog.on('mouseleave', () => {
      this.mouseInSettings = false
      this.alterInactivity()
    })
  }

  private alterInactivity () {
    if (this.menuOpened || this.mouseInSettings || this.mouseInControlBar) {
      this.setInactivityTimeout(0)
      return
    }

    this.setInactivityTimeout(this.initialInactivityTimeout)
    this.player.reportUserActivity(true)
  }

  private setInactivityTimeout (timeout: number) {
    (this.player as any).cache_.inactivityTimeout = timeout
    this.player.options_.inactivityTimeout = timeout
  }

  private initCaptions () {
    if (this.currentSubtitle) debugLogger('Init captions with current subtitle ' + this.currentSubtitle)
    else debugLogger('Init captions without current subtitle')

    this.player.tech(true).clearTracks('text')

    this.player.removeClass('vjs-has-captions')

    for (const caption of this.options.videoCaptions()) {
      this.player.addRemoteTextTrack({
        kind: 'captions',

        label: caption.automaticallyGenerated
          ? this.player.localize('{1} (auto-generated)', [ caption.label ])
          : caption.label,

        language: caption.language,
        id: caption.language,
        src: caption.src,
        default: this.currentSubtitle === caption.language
      }, true)

      this.player.addClass('vjs-has-captions')
    }

    this.player.trigger('captions-changed')
  }

  private updateControlBar () {
    debugLogger('Updating control bar')

    if (this.options.isLive()) {
      this.getPlaybackRateButton().hide()

      this.player.controlBar.getChild('progressControl').hide()
      this.player.controlBar.getChild('currentTimeDisplay').hide()
      this.player.controlBar.getChild('timeDivider').hide()
      this.player.controlBar.getChild('durationDisplay').hide()

      this.player.controlBar.getChild('peerTubeLiveDisplay').show()
    } else {
      this.getPlaybackRateButton().show()

      this.player.controlBar.getChild('progressControl').show()
      this.player.controlBar.getChild('currentTimeDisplay').show()
      this.player.controlBar.getChild('timeDivider').show()
      this.player.controlBar.getChild('durationDisplay').show()

      this.player.controlBar.getChild('peerTubeLiveDisplay').hide()
    }

    if (this.options.videoCaptions().length === 0) {
      this.getCaptionsButton().hide()
    } else {
      this.getCaptionsButton().show()
    }
  }

  private handleStartStopTime () {
    this.player.duration(this.options.videoDuration())

    if (this.stopTimeHandler) {
      this.player.off('timeupdate', this.stopTimeHandler)
      this.stopTimeHandler = undefined
    }

    // Prefer canplaythrough instead of canplay because Chrome has issues with the second one
    this.player.one('canplaythrough', () => {
      const startTime = this.options.startTime()

      if (startTime !== null && startTime !== undefined) {
        debugLogger('Start the video at ' + startTime)

        this.hasInitialSeek = true
        this.player.currentTime(timeToInt(startTime))
      }

      if (this.options.stopTime()) {
        const stopTime = timeToInt(this.options.stopTime())

        this.stopTimeHandler = () => {
          if (this.player.currentTime() <= stopTime) return

          debugLogger('Stopping the video at ' + this.options.stopTime())

          // Time top stop
          this.player.pause()
          this.player.trigger('auto-stopped')

          this.player.off('timeupdate', this.stopTimeHandler)
          this.stopTimeHandler = undefined
        }

        this.player.on('timeupdate', this.stopTimeHandler)
      }
    })
  }

  // Thanks: https://github.com/videojs/video.js/issues/4460#issuecomment-312861657
  private initSmoothProgressBar () {
    const SeekBar = videojs.getComponent('SeekBar') as any
    SeekBar.prototype.getPercent = function getPercent () {
      // Allows for smooth scrubbing, when player can't keep up.
      // const time = (this.player_.scrubbing()) ?
      //   this.player_.getCache().currentTime :
      //   this.player_.currentTime()
      const time = this.player_.currentTime()
      const percent = time / this.player_.duration()
      return percent >= 1 ? 1 : percent
    }
    SeekBar.prototype.handleMouseMove = function handleMouseMove (event: any) {
      let newTime = this.calculateDistance(event) * this.player_.duration()
      if (newTime === this.player_.duration()) {
        newTime = newTime - 0.1
      }
      this.player_.currentTime(newTime)
      this.update()
    }
  }

  private getCaptionsButton () {
    const settingsButton = this.player.controlBar.getDescendant([ 'settingsButton' ]) as SettingsButton

    return settingsButton.menu.getChild('captionsButton') as videojs.CaptionsButton
  }

  private getPlaybackRateButton () {
    const settingsButton = this.player.controlBar.getDescendant([ 'settingsButton' ]) as SettingsButton

    return settingsButton.menu.getChild('playbackRateMenuButton')
  }

  // We don't use webtorrent anymore, so we can safely remove old chunks from IndexedDB
  private deleteLegacyIndexedDB () {
    try {
      if (typeof window.indexedDB === 'undefined') return
      if (!window.indexedDB) return
      if (typeof window.indexedDB.databases !== 'function') return

      window.indexedDB.databases()
        .then(databases => {
          for (const db of databases) {
            window.indexedDB.deleteDatabase(db.name)
          }
        })
    } catch (err) {
      debugLogger('Cannot delete legacy indexed DB', err)
      // Nothing to do
    }
  }
}

videojs.registerPlugin('peertube', PeerTubePlugin)
export { PeerTubePlugin }
