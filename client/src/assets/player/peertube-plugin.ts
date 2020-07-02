import videojs from 'video.js'
import './videojs-components/settings-menu-button'
import {
  PeerTubePluginOptions,
  ResolutionUpdateData,
  UserWatching,
  VideoJSCaption
} from './peertube-videojs-typings'
import { isMobile, timeToInt } from './utils'
import {
  getStoredLastSubtitle,
  getStoredMute,
  getStoredVolume,
  saveLastSubtitle,
  saveMuteInStore,
  saveVolumeInStore
} from './peertube-player-local-storage'

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
  private lastResolutionChange: ResolutionUpdateData

  private menuOpened = false
  private mouseInControlBar = false
  private readonly savedInactivityTimeout: number

  constructor (player: videojs.Player, options?: PeerTubePluginOptions) {
    super(player)

    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration
    this.videoCaptions = options.videoCaptions

    this.savedInactivityTimeout = player.options_.inactivityTimeout

    if (options.autoplay) this.player.addClass('vjs-has-autoplay')

    this.player.on('autoplay-failure', () => {
      this.player.removeClass('vjs-has-autoplay')
    })

    this.player.ready(() => {
      const playerOptions = this.player.options_

      if (options.mode === 'webtorrent') {
        this.player.webtorrent().on('resolutionChange', (_: any, d: any) => this.handleResolutionChange(d))
        this.player.webtorrent().on('autoResolutionChange', (_: any, d: any) => this.trigger('autoResolutionChange', d))
      }

      if (options.mode === 'p2p-media-loader') {
        this.player.p2pMediaLoader().on('resolutionChange', (_: any, d: any) => this.handleResolutionChange(d))
      }

      this.player.tech(true).on('loadedqualitydata', () => {
        setTimeout(() => {
          // Replay a resolution change, now we loaded all quality data
          if (this.lastResolutionChange) this.handleResolutionChange(this.lastResolutionChange)
        }, 0)
      })

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

      this.player.textTracks().on('change', () => {
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

      if (options.userWatching) this.runUserWatchVideo(options.userWatching)
    })
  }

  dispose () {
    if (this.videoViewInterval) clearInterval(this.videoViewInterval)
    if (this.userWatchingVideoInterval) clearInterval(this.userWatchingVideoInterval)
  }

  onMenuOpen () {
    this.menuOpened = false
    this.alterInactivity()
  }

  onMenuClosed () {
    this.menuOpened = true
    this.alterInactivity()
  }

  private initializePlayer () {
    if (isMobile()) this.player.addClass('vjs-is-mobile')

    this.initSmoothProgressBar()

    this.initCaptions()

    this.listenControlBarMouse()
  }

  private runViewAdd () {
    this.clearVideoViewInterval()

    // After 30 seconds (or 3/4 of the video), add a view to the video
    let minSecondsToView = 30

    if (this.videoDuration < minSecondsToView) minSecondsToView = (this.videoDuration * 3) / 4

    let secondsViewed = 0
    this.videoViewInterval = setInterval(() => {
      if (this.player && !this.player.paused()) {
        secondsViewed += 1

        if (secondsViewed > minSecondsToView) {
          this.clearVideoViewInterval()

          this.addViewToVideo().catch(err => console.error(err))
        }
      }
    }, 1000)
  }

  private runUserWatchVideo (options: UserWatching) {
    let lastCurrentTime = 0

    this.userWatchingVideoInterval = setInterval(() => {
      const currentTime = Math.floor(this.player.currentTime())

      if (currentTime - lastCurrentTime >= 1) {
        lastCurrentTime = currentTime

        this.notifyUserIsWatching(currentTime, options.url, options.authorizationHeader)
          .catch(err => console.error('Cannot notify user is watching.', err))
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

    const headers = new Headers({ 'Authorization': authorizationHeader })

    return fetch(url, { method: 'PUT', body, headers })
  }

  private handleResolutionChange (data: ResolutionUpdateData) {
    this.lastResolutionChange = data

    const qualityLevels = this.player.qualityLevels()

    for (let i = 0; i < qualityLevels.length; i++) {
      if (qualityLevels[i].height === data.resolutionId) {
        data.id = qualityLevels[i].id
        break
      }
    }

    this.trigger('resolutionChange', data)
  }

  private listenControlBarMouse () {
    this.player.controlBar.on('mouseenter', () => {
      this.mouseInControlBar = true
      this.alterInactivity()
    })

    this.player.controlBar.on('mouseleave', () => {
      this.mouseInControlBar = false
      this.alterInactivity()
    })
  }

  private alterInactivity () {
    if (this.menuOpened) {
      this.player.options_.inactivityTimeout = this.savedInactivityTimeout
      return
    }

    if (!this.mouseInControlBar && !this.isTouchEnabled()) {
      this.player.options_.inactivityTimeout = 1
    }
  }

  private isTouchEnabled () {
    return ('ontouchstart' in window) ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
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
