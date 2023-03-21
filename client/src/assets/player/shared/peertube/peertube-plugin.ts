import debug from 'debug'
import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { isMobile } from '@root-helpers/web-browser'
import { timeToInt } from '@shared/core-utils'
import { VideoView, VideoViewEvent } from '@shared/models/videos'
import {
  getStoredLastSubtitle,
  getStoredMute,
  getStoredVolume,
  saveLastSubtitle,
  saveMuteInStore,
  saveVideoWatchHistory,
  saveVolumeInStore
} from '../../peertube-player-local-storage'
import { PeerTubePluginOptions, VideoJSCaption } from '../../types'
import { SettingsButton } from '../settings/settings-menu-button'

const debugLogger = debug('peertube:player:peertube')

const Plugin = videojs.getPlugin('plugin')

class PeerTubePlugin extends Plugin {
  private readonly videoViewUrl: string
  private readonly authorizationHeader: () => string

  private readonly videoUUID: string
  private readonly startTime: number

  private readonly videoViewIntervalMs: number

  private videoCaptions: VideoJSCaption[]
  private defaultSubtitle: string

  private videoViewInterval: any

  private menuOpened = false
  private mouseInControlBar = false
  private mouseInSettings = false
  private readonly initialInactivityTimeout: number

  constructor (player: videojs.Player, options?: PeerTubePluginOptions) {
    super(player)

    this.videoViewUrl = options.videoViewUrl
    this.authorizationHeader = options.authorizationHeader
    this.videoUUID = options.videoUUID
    this.startTime = timeToInt(options.startTime)
    this.videoViewIntervalMs = options.videoViewIntervalMs

    this.videoCaptions = options.videoCaptions
    this.initialInactivityTimeout = this.player.options_.inactivityTimeout

    if (options.autoplay !== false) this.player.addClass('vjs-has-autoplay')

    this.player.on('autoplay-failure', () => {
      this.player.removeClass('vjs-has-autoplay')
    })

    this.player.ready(() => {
      const playerOptions = this.player.options_

      const volume = getStoredVolume()
      if (volume !== undefined) this.player.volume(volume)

      const muted = playerOptions.muted !== undefined ? playerOptions.muted : getStoredMute()
      if (muted !== undefined) this.player.muted(muted)

      this.defaultSubtitle = options.subtitle || getStoredLastSubtitle()

      this.player.on('volumechange', () => {
        saveVolumeInStore(this.player.volume())
        saveMuteInStore(this.player.muted())
      })

      if (options.stopTime) {
        const stopTime = timeToInt(options.stopTime)
        const self = this

        this.player.on('timeupdate', function onTimeUpdate () {
          if (self.player.currentTime() > stopTime) {
            self.player.pause()
            self.player.trigger('stopped')

            self.player.off('timeupdate', onTimeUpdate)
          }
        })
      }

      this.player.textTracks().addEventListener('change', () => {
        const showing = this.player.textTracks().tracks_.find(t => {
          return t.kind === 'captions' && t.mode === 'showing'
        })

        if (!showing) {
          saveLastSubtitle('off')
          return
        }

        saveLastSubtitle(showing.language)
      })

      this.player.on('sourcechange', () => this.initCaptions())

      this.player.duration(options.videoDuration)

      this.initializePlayer()
      this.runUserViewing()
    })
  }

  dispose () {
    if (this.videoViewInterval) clearInterval(this.videoViewInterval)
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

    const modal = this.player.createModal(buildModal(this.player.error()), {
      temporary: false,
      uncloseable: true
    })
    modal.addClass('vjs-custom-error-display')

    this.player.addClass('vjs-error-display-enabled')
  }

  hideFatalError () {
    this.player.removeClass('vjs-error-display-enabled')
  }

  private initializePlayer () {
    if (isMobile()) this.player.addClass('vjs-is-mobile')

    this.initSmoothProgressBar()

    this.initCaptions()

    this.listenControlBarMouse()

    this.listenFullScreenChange()
  }

  // ---------------------------------------------------------------------------

  private runUserViewing () {
    let lastCurrentTime = this.startTime
    let lastViewEvent: VideoViewEvent

    this.player.one('play', () => {
      this.notifyUserIsWatching(this.startTime, lastViewEvent)
    })

    this.player.on('seeked', () => {
      // Don't take into account small seek events
      if (Math.abs(this.player.currentTime() - lastCurrentTime) < 3) return

      lastViewEvent = 'seek'
    })

    this.player.one('ended', () => {
      const currentTime = Math.floor(this.player.duration())
      lastCurrentTime = currentTime

      this.notifyUserIsWatching(currentTime, lastViewEvent)

      lastViewEvent = undefined
    })

    this.videoViewInterval = setInterval(() => {
      const currentTime = Math.floor(this.player.currentTime())

      // No need to update
      if (currentTime === lastCurrentTime) return

      lastCurrentTime = currentTime

      this.notifyUserIsWatching(currentTime, lastViewEvent)
        .catch(err => logger.error('Cannot notify user is watching.', err))

      lastViewEvent = undefined
    }, this.videoViewIntervalMs)
  }

  private notifyUserIsWatching (currentTime: number, viewEvent: VideoViewEvent) {
    // Server won't save history, so save the video position in local storage
    if (!this.authorizationHeader()) {
      saveVideoWatchHistory(this.videoUUID, currentTime)
    }

    if (!this.videoViewUrl) return Promise.resolve(true)

    const body: VideoView = { currentTime, viewEvent }

    const headers = new Headers({ 'Content-type': 'application/json; charset=UTF-8' })
    if (this.authorizationHeader()) headers.set('Authorization', this.authorizationHeader())

    return fetch(this.videoViewUrl, { method: 'POST', body: JSON.stringify(body), headers })
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

    debugLogger('Set player inactivity to ' + timeout)
  }

  private initCaptions () {
    for (const caption of this.videoCaptions) {
      this.player.addRemoteTextTrack({
        kind: 'captions',
        label: caption.label,
        language: caption.language,
        id: caption.language,
        src: caption.src,
        default: this.defaultSubtitle === caption.language
      }, false)
    }

    this.player.trigger('captionsChanged')
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
}

videojs.registerPlugin('peertube', PeerTubePlugin)
export { PeerTubePlugin }
