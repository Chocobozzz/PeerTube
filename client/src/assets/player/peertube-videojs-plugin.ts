import * as videojs from 'video.js'
import * as WebTorrent from 'webtorrent'
import { VideoFile } from '../../../../shared/models/videos/video.model'
import { renderVideo } from './video-renderer'
import './settings-menu-button'
import { PeertubePluginOptions, VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { getStoredMute, getStoredVolume, saveMuteInStore, saveVolumeInStore } from './utils'

const webtorrent = new WebTorrent({
  tracker: {
    rtcConfig: {
      iceServers: [
        {
          urls: 'stun:stun.stunprotocol.org'
        },
        {
          urls: 'stun:stun.framasoft.org'
        }
      ]
    }
  },
  dht: false
})

const Plugin: VideoJSComponentInterface = videojsUntyped.getPlugin('plugin')
class PeerTubePlugin extends Plugin {
  private readonly playerElement: HTMLVideoElement
  private readonly autoplay: boolean = false
  private readonly savePlayerSrcFunction: Function
  private player: any
  private currentVideoFile: VideoFile
  private videoFiles: VideoFile[]
  private torrent: WebTorrent.Torrent
  private videoViewUrl: string
  private videoDuration: number
  private videoViewInterval
  private torrentInfoInterval

  constructor (player: videojs.Player, options: PeertubePluginOptions) {
    super(player, options)

    // Fix canplay event on google chrome by disabling default videojs autoplay
    this.autoplay = this.player.options_.autoplay
    this.player.options_.autoplay = false

    this.videoFiles = options.videoFiles
    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration

    this.savePlayerSrcFunction = this.player.src
    // Hack to "simulate" src link in video.js >= 6
    // Without this, we can't play the video after pausing it
    // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
    this.player.src = () => true

    this.playerElement = options.playerElement

    this.player.ready(() => {
      const volume = getStoredVolume()
      if (volume !== undefined) this.player.volume(volume)
      const muted = getStoredMute()
      if (muted !== undefined) this.player.muted(muted)

      this.initializePlayer()
      this.runTorrentInfoScheduler()
      this.runViewAdd()
    })

    this.player.on('volumechange', () => {
      saveVolumeInStore(this.player.volume())
      saveMuteInStore(this.player.muted())
    })
  }

  dispose () {
    clearInterval(this.videoViewInterval)
    clearInterval(this.torrentInfoInterval)

    // Don't need to destroy renderer, video player will be destroyed
    this.flushVideoFile(this.currentVideoFile, false)
  }

  getCurrentResolutionId () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.id : -1
  }

  getCurrentResolutionLabel () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.label : ''
  }

  updateVideoFile (videoFile?: VideoFile, done?: () => void) {
    if (done === undefined) {
      done = () => { /* empty */ }
    }

    // Pick the first one
    if (videoFile === undefined) {
      videoFile = this.videoFiles[0]
    }

    // Don't add the same video file once again
    if (this.currentVideoFile !== undefined && this.currentVideoFile.magnetUri === videoFile.magnetUri) {
      return
    }

    // Do not display error to user because we will have multiple fallback
    this.disableErrorDisplay()

    this.player.src = () => true
    const oldPlaybackRate = this.player.playbackRate()

    const previousVideoFile = this.currentVideoFile
    this.currentVideoFile = videoFile

    this.addTorrent(this.currentVideoFile.magnetUri, previousVideoFile, () => {
      this.player.playbackRate(oldPlaybackRate)
      return done()
    })

    this.trigger('videoFileUpdate')
  }

  addTorrent (magnetOrTorrentUrl: string, previousVideoFile: VideoFile, done: Function) {
    console.log('Adding ' + magnetOrTorrentUrl + '.')

    this.torrent = webtorrent.add(magnetOrTorrentUrl, torrent => {
      console.log('Added ' + magnetOrTorrentUrl + '.')

      this.flushVideoFile(previousVideoFile)

      const options = { autoplay: true, controls: true }
      renderVideo(torrent.files[0], this.playerElement, options,(err, renderer) => {
        this.renderer = renderer

        if (err) return this.fallbackToHttp(done)

        if (!this.player.paused()) {
          const playPromise = this.player.play()
          if (playPromise !== undefined) return playPromise.then(done)

          return done()
        }

        return done()
      })
    })

    this.torrent.on('error', err => this.handleError(err))

    this.torrent.on('warning', (err: any) => {
      // We don't support HTTP tracker but we don't care -> we use the web socket tracker
      if (err.message.indexOf('Unsupported tracker protocol') !== -1) return

      // Users don't care about issues with WebRTC, but developers do so log it in the console
      if (err.message.indexOf('Ice connection failed') !== -1) {
        console.error(err)
        return
      }

      // Magnet hash is not up to date with the torrent file, add directly the torrent file
      if (err.message.indexOf('incorrect info hash') !== -1) {
        console.error('Incorrect info hash detected, falling back to torrent file.')
        return this.addTorrent(this.torrent['xs'], previousVideoFile, done)
      }

      return this.handleError(err)
    })
  }

  updateResolution (resolutionId: number) {
    // Remember player state
    const currentTime = this.player.currentTime()
    const isPaused = this.player.paused()

    // Remove poster to have black background
    this.playerElement.poster = ''

    // Hide bigPlayButton
    if (!isPaused) {
      this.player.bigPlayButton.hide()
    }

    const newVideoFile = this.videoFiles.find(f => f.resolution.id === resolutionId)
    this.updateVideoFile(newVideoFile, () => {
      this.player.currentTime(currentTime)
      this.player.handleTechSeeked_()
    })
  }

  flushVideoFile (videoFile: VideoFile, destroyRenderer = true) {
    if (videoFile !== undefined && webtorrent.get(videoFile.magnetUri)) {
      if (destroyRenderer === true && this.renderer && this.renderer.destroy) this.renderer.destroy()

      webtorrent.remove(videoFile.magnetUri)
      console.log('Removed ' + videoFile.magnetUri)
    }
  }

  setVideoFiles (files: VideoFile[], videoViewUrl: string, videoDuration: number) {
    this.videoViewUrl = videoViewUrl
    this.videoDuration = videoDuration
    this.videoFiles = files

    // Re run view add for the new video
    this.runViewAdd()
    this.updateVideoFile(undefined, () => this.player.play())
  }

  private initializePlayer () {
    this.initSmoothProgressBar()

    this.alterInactivity()

    if (this.autoplay === true) {
      this.player.posterImage.hide()
      this.updateVideoFile(undefined, () => this.player.play())
    } else {
      // Proxify first play
      const oldPlay = this.player.play.bind(this.player)
      this.player.play = () => {
        this.updateVideoFile(undefined, () => oldPlay)
        this.player.play = oldPlay
      }
    }
  }

  private runTorrentInfoScheduler () {
    this.torrentInfoInterval = setInterval(() => {
      // Not initialized yet
      if (this.torrent === undefined) return

      // Http fallback
      if (this.torrent === null) return this.trigger('torrentInfo', false)

      return this.trigger('torrentInfo', {
        downloadSpeed: this.torrent.downloadSpeed,
        numPeers: this.torrent.numPeers,
        uploadSpeed: this.torrent.uploadSpeed
      })
    }, 1000)
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

  private clearVideoViewInterval () {
    if (this.videoViewInterval !== undefined) {
      clearInterval(this.videoViewInterval)
      this.videoViewInterval = undefined
    }
  }

  private addViewToVideo () {
    return fetch(this.videoViewUrl, { method: 'POST' })
  }

  private fallbackToHttp (done: Function) {
    this.flushVideoFile(this.currentVideoFile, true)
    this.torrent = null

    // Enable error display now this is our last fallback
    this.player.one('error', () => this.enableErrorDisplay())

    const httpUrl = this.currentVideoFile.fileUrl
    this.player.src = this.savePlayerSrcFunction
    this.player.src(httpUrl)
    this.player.play()

    return done()
  }

  private handleError (err: Error | string) {
    return this.player.trigger('customError', { err })
  }

  private enableErrorDisplay () {
    this.player.addClass('vjs-error-display-enabled')
  }

  private disableErrorDisplay () {
    this.player.removeClass('vjs-error-display-enabled')
  }

  private alterInactivity () {
    let saveInactivityTimeout: number

    const disableInactivity = () => {
      saveInactivityTimeout = this.player.options_.inactivityTimeout
      this.player.options_.inactivityTimeout = 0
    }
    const enableInactivity = () => {
      // this.player.options_.inactivityTimeout = saveInactivityTimeout
    }

    const settingsDialog = this.player.children_.find(c => c.name_ === 'SettingsDialog')

    this.player.controlBar.on('mouseenter', () => disableInactivity())
    settingsDialog.on('mouseenter', () => disableInactivity())
    this.player.controlBar.on('mouseleave', () => enableInactivity())
    settingsDialog.on('mouseleave', () => enableInactivity())
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
    SeekBar.prototype.handleMouseMove = function handleMouseMove (event) {
      let newTime = this.calculateDistance(event) * this.player_.duration()
      if (newTime === this.player_.duration()) {
        newTime = newTime - 0.1
      }
      this.player_.currentTime(newTime)
      this.update()
    }
  }
}

videojsUntyped.registerPlugin('peertube', PeerTubePlugin)
export { PeerTubePlugin }
