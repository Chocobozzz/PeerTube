import videojs from 'video.js'
import { timeToInt } from '@shared/core-utils'
import {
  getStoredLastSubtitle,
  getStoredMute,
  getStoredVolume,
  saveLastSubtitle,
  saveMuteInStore,
  saveVideoWatchHistory,
  saveVolumeInStore
} from './peertube-player-local-storage'
import { PeerTubePluginOptions, UserWatching, VideoJSCaption } from './peertube-videojs-typings'
import { isMobile } from './utils'
import { SettingsButton } from './videojs-components/settings-menu-button'

const Plugin = videojs.getPlugin('plugin')

class PeerTubePlugin extends Plugin {
  private readonly videoViewUrl: string
  private readonly videoDuration: number
  private readonly CONSTANTS = {
    USER_WATCHING_VIDEO_INTERVAL: 5000 // Every 5 seconds, notify the user is watching the video
  }

  private videoCaptions: VideoJSCaption[]
  private defaultSubtitle: string

  private videoViewInterval: any
  private userWatchingVideoInterval: any

  private isLive: boolean

  private menuOpened = false
  private mouseInControlBar = false
  private mouseInSettings = false
  private readonly initialInactivityTimeout: number

  constructor (player: videojs.Player, options?: PeerTubePluginOptions) {
    super(player)

    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration
    this.videoCaptions = options.videoCaptions
    this.isLive = options.isLive
    this.initialInactivityTimeout = this.player.options_.inactivityTimeout

    if (options.autoplay) this.player.addClass('vjs-has-autoplay')

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
      this.runViewAdd()

      this.runUserWatchVideo(options.userWatching, options.videoUUID)
    })
  }

  dispose () {
    if (this.videoViewInterval) clearInterval(this.videoViewInterval)
    if (this.userWatchingVideoInterval) clearInterval(this.userWatchingVideoInterval)
  }

  onMenuOpened () {
    this.menuOpened = true
    this.alterInactivity()
  }

  onMenuClosed () {
    this.menuOpened = false
    this.alterInactivity()
  }

  private initializePlayer () {
    if (isMobile()) this.player.addClass('vjs-is-mobile')

    this.initSmoothProgressBar()

    this.initCaptions()

    this.listenControlBarMouse()

    this.listenFullScreenChange()
  }

  private runViewAdd () {
    this.clearVideoViewInterval()

    // After 30 seconds (or 3/4 of the video), add a view to the video
    let minSecondsToView = 30

    if (!this.isLive && this.videoDuration < minSecondsToView) {
      minSecondsToView = (this.videoDuration * 3) / 4
    }

    let secondsViewed = 0
    this.videoViewInterval = setInterval(() => {
      if (this.player && !this.player.paused()) {
        secondsViewed += 1

        if (secondsViewed > minSecondsToView) {
          // Restart the loop if this is a live
          if (this.isLive) {
            secondsViewed = 0
          } else {
            this.clearVideoViewInterval()
          }

          this.addViewToVideo().catch(err => console.error(err))
        }
      }
    }, 1000)
  }

  private runUserWatchVideo (options: UserWatching, videoUUID: string) {
    let lastCurrentTime = 0

    this.userWatchingVideoInterval = setInterval(() => {
      const currentTime = Math.floor(this.player.currentTime())

      if (currentTime - lastCurrentTime >= 1) {
        lastCurrentTime = currentTime

        if (options) {
          this.notifyUserIsWatching(currentTime, options.url, options.authorizationHeader)
            .catch(err => console.error('Cannot notify user is watching.', err))
        } else {
          saveVideoWatchHistory(videoUUID, currentTime)
        }
      }
    }, this.CONSTANTS.USER_WATCHING_VIDEO_INTERVAL)
  }

  private clearVideoViewInterval () {
    if (this.videoViewInterval !== undefined) {
      clearInterval(this.videoViewInterval)
      this.videoViewInterval = undefined
    }
  }

  private addViewToVideo () {
    if (!this.videoViewUrl) return Promise.resolve(undefined)

    return fetch(this.videoViewUrl, { method: 'POST' })
  }

  private notifyUserIsWatching (currentTime: number, url: string, authorizationHeader: string) {
    const body = new URLSearchParams()
    body.append('currentTime', currentTime.toString())

    const headers = new Headers({ Authorization: authorizationHeader })

    return fetch(url, { method: 'PUT', body, headers })
  }

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
    if (this.menuOpened || this.mouseInSettings || this.mouseInControlBar || this.isTouchEnabled()) {
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

  private isTouchEnabled () {
    return ('ontouchstart' in window) ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
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
