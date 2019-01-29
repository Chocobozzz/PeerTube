// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import * as videojs from 'video.js'
import './videojs-components/settings-menu-button'
import {
  PeerTubePluginOptions,
  ResolutionUpdateData,
  UserWatching,
  VideoJSCaption,
  VideoJSComponentInterface,
  videojsUntyped
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

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class PeerTubePlugin extends Plugin {
  private readonly autoplay: boolean = false
  private readonly startTime: number = 0
  private readonly videoViewUrl: string
  private readonly videoDuration: number
  private readonly CONSTANTS = {
    USER_WATCHING_VIDEO_INTERVAL: 5000 // Every 5 seconds, notify the user is watching the video
  }

  private player: any
  private videoCaptions: VideoJSCaption[]
  private defaultSubtitle: string

  private videoViewInterval: any
  private userWatchingVideoInterval: any
  private qualityObservationTimer: any
  private lastResolutionChange: ResolutionUpdateData

  constructor (player: videojs.Player, options: PeerTubePluginOptions) {
    super(player, options)

    this.startTime = timeToInt(options.startTime)
    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration
    this.videoCaptions = options.videoCaptions

    if (this.autoplay === true) this.player.addClass('vjs-has-autoplay')

    this.player.ready(() => {
      const playerOptions = this.player.options_

      if (options.mode === 'webtorrent') {
        this.player.webtorrent().on('resolutionChange', (_: any, d: any) => this.handleResolutionChange(d))
        this.player.webtorrent().on('autoResolutionChange', (_: any, d: any) => this.trigger('autoResolutionChange', d))
      }

      if (options.mode === 'p2p-media-loader') {
        this.player.p2pMediaLoader().on('resolutionChange', (_: any, d: any) => this.handleResolutionChange(d))
      }

      this.player.tech_.on('loadedqualitydata', () => {
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

      this.player.textTracks().on('change', () => {
        const showing = this.player.textTracks().tracks_.find((t: { kind: string, mode: string }) => {
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
    clearTimeout(this.qualityObservationTimer)

    clearInterval(this.videoViewInterval)

    if (this.userWatchingVideoInterval) clearInterval(this.userWatchingVideoInterval)
  }

  private initializePlayer () {
    if (isMobile()) this.player.addClass('vjs-is-mobile')

    this.initSmoothProgressBar()

    this.initCaptions()

    this.alterInactivity()
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

  private alterInactivity () {
    let saveInactivityTimeout: number

    const disableInactivity = () => {
      saveInactivityTimeout = this.player.options_.inactivityTimeout
      this.player.options_.inactivityTimeout = 0
    }
    const enableInactivity = () => {
      this.player.options_.inactivityTimeout = saveInactivityTimeout
    }

    const settingsDialog = this.player.children_.find((c: any) => c.name_ === 'SettingsDialog')

    this.player.controlBar.on('mouseenter', () => disableInactivity())
    settingsDialog.on('mouseenter', () => disableInactivity())
    this.player.controlBar.on('mouseleave', () => enableInactivity())
    settingsDialog.on('mouseleave', () => enableInactivity())
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
    const SeekBar = videojsUntyped.getComponent('SeekBar')
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
