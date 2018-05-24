import * as videojs from 'video.js'
import * as WebTorrent from 'webtorrent'
import { VideoFile } from '../../../../shared/models/videos/video.model'
import { renderVideo } from './video-renderer'
import './settings-menu-button'
import { PeertubePluginOptions, VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import {
  getAverageBandwidth,
  getStoredMute,
  getStoredVolume,
  isMobile,
  saveAverageBandwidth,
  saveMuteInStore,
  saveVolumeInStore
} from './utils'
import minBy from 'lodash-es/minBy'
import maxBy from 'lodash-es/maxBy'
import * as CacheChunkStore from 'cache-chunk-store'
import { PeertubeChunkStore } from './peertube-chunk-store'

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
  private readonly startTime: number = 0
  private readonly savePlayerSrcFunction: Function
  private readonly videoFiles: VideoFile[]
  private readonly videoViewUrl: string
  private readonly videoDuration: number
  private readonly CONSTANTS = {
    INFO_SCHEDULER: 1000, // Don't change this
    AUTO_QUALITY_SCHEDULER: 3000, // Check quality every 3 seconds
    AUTO_QUALITY_THRESHOLD_PERCENT: 30, // Bandwidth should be 30% more important than a resolution bitrate to change to it
    AUTO_QUALITY_OBSERVATION_TIME: 10000, // Wait 10 seconds after having change the resolution before another check
    AUTO_QUALITY_HIGHER_RESOLUTION_DELAY: 5000, // Buffering higher resolution during 5 seconds
    BANDWIDTH_AVERAGE_NUMBER_OF_VALUES: 5 // Last 5 seconds to build average bandwidth
  }

  private player: any
  private currentVideoFile: VideoFile
  private torrent: WebTorrent.Torrent
  private autoResolution = true
  private isAutoResolutionObservation = false

  private videoViewInterval
  private torrentInfoInterval
  private autoQualityInterval
  private addTorrentDelay
  private qualityObservationTimer
  private runAutoQualitySchedulerTimer

  private downloadSpeeds: number[] = []

  constructor (player: videojs.Player, options: PeertubePluginOptions) {
    super(player, options)

    // Disable auto play on iOS
    this.autoplay = options.autoplay && this.isIOS() === false

    this.startTime = options.startTime
    this.videoFiles = options.videoFiles
    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration

    this.savePlayerSrcFunction = this.player.src
    // Hack to "simulate" src link in video.js >= 6
    // Without this, we can't play the video after pausing it
    // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
    this.player.src = () => true

    this.playerElement = options.playerElement

    if (this.autoplay === true) this.player.addClass('vjs-has-autoplay')

    this.player.ready(() => {
      const volume = getStoredVolume()
      if (volume !== undefined) this.player.volume(volume)
      const muted = getStoredMute()
      if (muted !== undefined) this.player.muted(muted)

      this.initializePlayer()
      this.runTorrentInfoScheduler()
      this.runViewAdd()

      this.player.one('play', () => {
        // Don't run immediately scheduler, wait some seconds the TCP connections are made
        this.runAutoQualitySchedulerTimer = setTimeout(() => {
          this.runAutoQualityScheduler()
        }, this.CONSTANTS.AUTO_QUALITY_SCHEDULER)
      })
    })

    this.player.on('volumechange', () => {
      saveVolumeInStore(this.player.volume())
      saveMuteInStore(this.player.muted())
    })
  }

  dispose () {
    clearTimeout(this.addTorrentDelay)
    clearTimeout(this.qualityObservationTimer)
    clearTimeout(this.runAutoQualitySchedulerTimer)

    clearInterval(this.videoViewInterval)
    clearInterval(this.torrentInfoInterval)
    clearInterval(this.autoQualityInterval)

    // Don't need to destroy renderer, video player will be destroyed
    this.flushVideoFile(this.currentVideoFile, false)
  }

  getCurrentResolutionId () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.id : -1
  }

  getCurrentResolutionLabel () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.label : ''
  }

  updateVideoFile (videoFile?: VideoFile, delay = 0, done?: () => void) {
    if (done === undefined) {
      done = () => { /* empty */ }
    }

    // Automatically choose the adapted video file
    if (videoFile === undefined) {
      const savedAverageBandwidth = getAverageBandwidth()
      videoFile = savedAverageBandwidth
        ? this.getAppropriateFile(savedAverageBandwidth)
        : this.videoFiles[0]
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

    this.addTorrent(this.currentVideoFile.magnetUri, previousVideoFile, delay, () => {
      this.player.playbackRate(oldPlaybackRate)
      return done()
    })

    this.trigger('videoFileUpdate')
  }

  addTorrent (magnetOrTorrentUrl: string, previousVideoFile: VideoFile, delay = 0, done: Function) {
    console.log('Adding ' + magnetOrTorrentUrl + '.')

    const oldTorrent = this.torrent
    const options = {
      store: (chunkLength, storeOpts) => new CacheChunkStore(new PeertubeChunkStore(chunkLength, storeOpts), {
        max: 100
      })
    }

    this.torrent = webtorrent.add(magnetOrTorrentUrl, options, torrent => {
      console.log('Added ' + magnetOrTorrentUrl + '.')

      // Pause the old torrent
      if (oldTorrent) {
        oldTorrent.pause()
        // Pause does not remove actual peers (in particular the webseed peer)
        oldTorrent.removePeer(oldTorrent['ws'])
      }

      // Render the video in a few seconds? (on resolution change for example, we wait some seconds of the new video resolution)
      this.addTorrentDelay = setTimeout(() => {
        this.flushVideoFile(previousVideoFile)

        const options = { autoplay: true, controls: true }
        renderVideo(torrent.files[0], this.playerElement, options,(err, renderer) => {
          this.renderer = renderer

          if (err) return this.fallbackToHttp(done)

          if (!this.player.paused()) return this.tryToPlay(done)

          return done()
        })
      }, delay)
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
        return this.addTorrent(this.torrent['xs'], previousVideoFile, 0, done)
      }

      return this.handleError(err)
    })
  }

  updateResolution (resolutionId: number, delay = 0) {
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
    this.updateVideoFile(newVideoFile, delay, () => this.seek(currentTime))
  }

  flushVideoFile (videoFile: VideoFile, destroyRenderer = true) {
    if (videoFile !== undefined && webtorrent.get(videoFile.magnetUri)) {
      if (destroyRenderer === true && this.renderer && this.renderer.destroy) this.renderer.destroy()

      webtorrent.remove(videoFile.magnetUri)
      console.log('Removed ' + videoFile.magnetUri)
    }
  }

  isAutoResolutionOn () {
    return this.autoResolution
  }

  enableAutoResolution () {
    this.autoResolution = true
    this.trigger('autoResolutionUpdate')
  }

  disableAutoResolution () {
    this.autoResolution = false
    this.trigger('autoResolutionUpdate')
  }

  private tryToPlay (done?: Function) {
    if (!done) done = function () { /* empty */ }

    const playPromise = this.player.play()
    if (playPromise !== undefined) {
      return playPromise.then(done)
                        .catch(err => {
                          console.error(err)
                          this.player.pause()
                          this.player.posterImage.show()
                          this.player.removeClass('vjs-has-autoplay')

                          return done()
                        })
    }

    return done()
  }

  private seek (time: number) {
    this.player.currentTime(time)
    this.player.handleTechSeeked_()
  }

  private getAppropriateFile (averageDownloadSpeed?: number): VideoFile {
    if (this.videoFiles === undefined || this.videoFiles.length === 0) return undefined
    if (this.videoFiles.length === 1) return this.videoFiles[0]

    // Don't change the torrent is the play was ended
    if (this.torrent && this.torrent.progress === 1 && this.player.ended()) return this.currentVideoFile

    if (!averageDownloadSpeed) averageDownloadSpeed = this.getAndSaveActualDownloadSpeed()

    // Filter videos we can play according to our bandwidth
    const filteredFiles = this.videoFiles.filter(f => {
      const fileBitrate = (f.size / this.videoDuration)
      let threshold = fileBitrate

      // If this is for a higher resolution or an initial load: add a margin
      if (!this.currentVideoFile || f.resolution.id > this.currentVideoFile.resolution.id) {
        threshold += ((fileBitrate * this.CONSTANTS.AUTO_QUALITY_THRESHOLD_PERCENT) / 100)
      }

      return averageDownloadSpeed > threshold
    })

    // If the download speed is too bad, return the lowest resolution we have
    if (filteredFiles.length === 0) return minBy(this.videoFiles, 'resolution.id')

    return maxBy(filteredFiles, 'resolution.id')
  }

  private getAndSaveActualDownloadSpeed () {
    const start = Math.max(this.downloadSpeeds.length - this.CONSTANTS.BANDWIDTH_AVERAGE_NUMBER_OF_VALUES, 0)
    const lastDownloadSpeeds = this.downloadSpeeds.slice(start, this.downloadSpeeds.length)
    if (lastDownloadSpeeds.length === 0) return -1

    const sum = lastDownloadSpeeds.reduce((a, b) => a + b)
    const averageBandwidth = Math.round(sum / lastDownloadSpeeds.length)

    // Save the average bandwidth for future use
    saveAverageBandwidth(averageBandwidth)

    return averageBandwidth
  }

  private initializePlayer () {
    this.initSmoothProgressBar()

    this.alterInactivity()

    if (this.autoplay === true) {
      this.player.posterImage.hide()

      this.updateVideoFile(undefined, 0, () => {
        this.seek(this.startTime)
        this.tryToPlay()
      })
    } else {
      // Don't try on iOS that does not support MediaSource
      if (this.isIOS()) {
        this.currentVideoFile = this.videoFiles[0]
        return this.fallbackToHttp(undefined, false)
      }

      // Proxy first play
      const oldPlay = this.player.play.bind(this.player)
      this.player.play = () => {
        this.player.addClass('vjs-has-big-play-button-clicked')
        this.player.play = oldPlay

        this.updateVideoFile(undefined, 0, () => this.seek(this.startTime))
      }
    }
  }

  private runAutoQualityScheduler () {
    this.autoQualityInterval = setInterval(() => {

      // Not initialized or in HTTP fallback
      if (this.torrent === undefined || this.torrent === null) return
      if (this.isAutoResolutionOn() === false) return
      if (this.isAutoResolutionObservation === true) return

      const file = this.getAppropriateFile()
      let changeResolution = false
      let changeResolutionDelay = 0

      // Lower resolution
      if (this.isPlayerWaiting() && file.resolution.id < this.currentVideoFile.resolution.id) {
        console.log('Downgrading automatically the resolution to: %s', file.resolution.label)
        changeResolution = true
      } else if (file.resolution.id > this.currentVideoFile.resolution.id) { // Higher resolution
        console.log('Upgrading automatically the resolution to: %s', file.resolution.label)
        changeResolution = true
        changeResolutionDelay = this.CONSTANTS.AUTO_QUALITY_HIGHER_RESOLUTION_DELAY
      }

      if (changeResolution === true) {
        this.updateResolution(file.resolution.id, changeResolutionDelay)

        // Wait some seconds in observation of our new resolution
        this.isAutoResolutionObservation = true

        this.qualityObservationTimer = setTimeout(() => {
          this.isAutoResolutionObservation = false
        }, this.CONSTANTS.AUTO_QUALITY_OBSERVATION_TIME)
      }
    }, this.CONSTANTS.AUTO_QUALITY_SCHEDULER)
  }

  private isPlayerWaiting () {
    return this.player && this.player.hasClass('vjs-waiting')
  }

  private runTorrentInfoScheduler () {
    this.torrentInfoInterval = setInterval(() => {
      // Not initialized yet
      if (this.torrent === undefined) return

      // Http fallback
      if (this.torrent === null) return this.trigger('torrentInfo', false)

      // webtorrent.downloadSpeed because we need to take into account the potential old torrent too
      if (webtorrent.downloadSpeed !== 0) this.downloadSpeeds.push(webtorrent.downloadSpeed)

      return this.trigger('torrentInfo', {
        downloadSpeed: this.torrent.downloadSpeed,
        numPeers: this.torrent.numPeers,
        uploadSpeed: this.torrent.uploadSpeed
      })
    }, this.CONSTANTS.INFO_SCHEDULER)
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

  private fallbackToHttp (done?: Function, play = true) {
    this.flushVideoFile(this.currentVideoFile, true)
    this.torrent = null

    // Enable error display now this is our last fallback
    this.player.one('error', () => this.enableErrorDisplay())

    const httpUrl = this.currentVideoFile.fileUrl
    this.player.src = this.savePlayerSrcFunction
    this.player.src(httpUrl)
    if (play) this.tryToPlay()

    if (done) return done()
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

  private isIOS () {
    return !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)
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
