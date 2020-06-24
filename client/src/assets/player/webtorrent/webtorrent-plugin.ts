import videojs from 'video.js'
import * as WebTorrent from 'webtorrent'
import { renderVideo } from './video-renderer'
import { LoadedQualityData, PlayerNetworkInfo, WebtorrentPluginOptions } from '../peertube-videojs-typings'
import { getRtcConfig, timeToInt, videoFileMaxByResolution, videoFileMinByResolution, isIOS, isSafari } from '../utils'
import { PeertubeChunkStore } from './peertube-chunk-store'
import {
  getAverageBandwidthInStore,
  getStoredMute,
  getStoredP2PEnabled,
  getStoredVolume,
  saveAverageBandwidth
} from '../peertube-player-local-storage'
import { VideoFile } from '@shared/models'

const CacheChunkStore = require('cache-chunk-store')

type PlayOptions = {
  forcePlay?: boolean,
  seek?: number,
  delay?: number
}

const Plugin = videojs.getPlugin('plugin')

class WebTorrentPlugin extends Plugin {
  readonly videoFiles: VideoFile[]

  private readonly playerElement: HTMLVideoElement

  private readonly autoplay: boolean = false
  private readonly startTime: number = 0
  private readonly savePlayerSrcFunction: videojs.Player['src']
  private readonly videoDuration: number
  private readonly CONSTANTS = {
    INFO_SCHEDULER: 1000, // Don't change this
    AUTO_QUALITY_SCHEDULER: 3000, // Check quality every 3 seconds
    AUTO_QUALITY_THRESHOLD_PERCENT: 30, // Bandwidth should be 30% more important than a resolution bitrate to change to it
    AUTO_QUALITY_OBSERVATION_TIME: 10000, // Wait 10 seconds after having change the resolution before another check
    AUTO_QUALITY_HIGHER_RESOLUTION_DELAY: 5000, // Buffering higher resolution during 5 seconds
    BANDWIDTH_AVERAGE_NUMBER_OF_VALUES: 5 // Last 5 seconds to build average bandwidth
  }

  private readonly webtorrent = new WebTorrent({
    tracker: {
      rtcConfig: getRtcConfig()
    },
    dht: false
  })

  private currentVideoFile: VideoFile
  private torrent: WebTorrent.Torrent

  private renderer: any
  private fakeRenderer: any
  private destroyingFakeRenderer = false

  private autoResolution = true
  private autoResolutionPossible = true
  private isAutoResolutionObservation = false
  private playerRefusedP2P = false

  private torrentInfoInterval: any
  private autoQualityInterval: any
  private addTorrentDelay: any
  private qualityObservationTimer: any
  private runAutoQualitySchedulerTimer: any

  private downloadSpeeds: number[] = []

  constructor (player: videojs.Player, options?: WebtorrentPluginOptions) {
    super(player)

    this.startTime = timeToInt(options.startTime)

    // Disable auto play on iOS
    this.autoplay = options.autoplay && isIOS() === false
    this.playerRefusedP2P = !getStoredP2PEnabled()

    this.videoFiles = options.videoFiles
    this.videoDuration = options.videoDuration

    this.savePlayerSrcFunction = this.player.src
    this.playerElement = options.playerElement

    this.player.ready(() => {
      const playerOptions = this.player.options_

      const volume = getStoredVolume()
      if (volume !== undefined) this.player.volume(volume)

      const muted = playerOptions.muted !== undefined ? playerOptions.muted : getStoredMute()
      if (muted !== undefined) this.player.muted(muted)

      this.player.duration(options.videoDuration)

      this.initializePlayer()
      this.runTorrentInfoScheduler()

      this.player.one('play', () => {
        // Don't run immediately scheduler, wait some seconds the TCP connections are made
        this.runAutoQualitySchedulerTimer = setTimeout(() => this.runAutoQualityScheduler(), this.CONSTANTS.AUTO_QUALITY_SCHEDULER)
      })
    })
  }

  dispose () {
    clearTimeout(this.addTorrentDelay)
    clearTimeout(this.qualityObservationTimer)
    clearTimeout(this.runAutoQualitySchedulerTimer)

    clearInterval(this.torrentInfoInterval)
    clearInterval(this.autoQualityInterval)

    // Don't need to destroy renderer, video player will be destroyed
    this.flushVideoFile(this.currentVideoFile, false)

    this.destroyFakeRenderer()
  }

  getCurrentResolutionId () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.id : -1
  }

  updateVideoFile (
    videoFile?: VideoFile,
    options: {
      forcePlay?: boolean,
      seek?: number,
      delay?: number
    } = {},
    done: () => void = () => { /* empty */ }
  ) {
    // Automatically choose the adapted video file
    if (videoFile === undefined) {
      const savedAverageBandwidth = getAverageBandwidthInStore()
      videoFile = savedAverageBandwidth
        ? this.getAppropriateFile(savedAverageBandwidth)
        : this.pickAverageVideoFile()
    }

    // Don't add the same video file once again
    if (this.currentVideoFile !== undefined && this.currentVideoFile.magnetUri === videoFile.magnetUri) {
      return
    }

    // Do not display error to user because we will have multiple fallback
    this.disableErrorDisplay();

    // Hack to "simulate" src link in video.js >= 6
    // Without this, we can't play the video after pausing it
    // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
    (this.player as any).src = () => true
    const oldPlaybackRate = this.player.playbackRate()

    const previousVideoFile = this.currentVideoFile
    this.currentVideoFile = videoFile

    // Don't try on iOS that does not support MediaSource
    // Or don't use P2P if webtorrent is disabled
    if (isIOS() || this.playerRefusedP2P) {
      return this.fallbackToHttp(options, () => {
        this.player.playbackRate(oldPlaybackRate)
        return done()
      })
    }

    this.addTorrent(this.currentVideoFile.magnetUri, previousVideoFile, options, () => {
      this.player.playbackRate(oldPlaybackRate)
      return done()
    })

    this.changeQuality()
    this.trigger('resolutionChange', { auto: this.autoResolution, resolutionId: this.currentVideoFile.resolution.id })
  }

  updateResolution (resolutionId: number, delay = 0) {
    // Remember player state
    const currentTime = this.player.currentTime()
    const isPaused = this.player.paused()

    // Hide bigPlayButton
    if (!isPaused) {
      this.player.bigPlayButton.hide()
    }

    // Audio-only (resolutionId === 0) gets special treatment
    if (resolutionId === 0) {
      // Audio-only: show poster, do not auto-hide controls
      this.player.addClass('vjs-playing-audio-only-content')
      this.player.posterImage.show()
    } else {
      // Hide poster to have black background
      this.player.removeClass('vjs-playing-audio-only-content')
      this.player.posterImage.hide()
    }

    const newVideoFile = this.videoFiles.find(f => f.resolution.id === resolutionId)
    const options = {
      forcePlay: false,
      delay,
      seek: currentTime + (delay / 1000)
    }

    this.updateVideoFile(newVideoFile, options)
  }

  flushVideoFile (videoFile: VideoFile, destroyRenderer = true) {
    if (videoFile !== undefined && this.webtorrent.get(videoFile.magnetUri)) {
      if (destroyRenderer === true && this.renderer && this.renderer.destroy) this.renderer.destroy()

      this.webtorrent.remove(videoFile.magnetUri)
      console.log('Removed ' + videoFile.magnetUri)
    }
  }

  enableAutoResolution () {
    this.autoResolution = true
    this.trigger('resolutionChange', { auto: this.autoResolution, resolutionId: this.getCurrentResolutionId() })
  }

  disableAutoResolution (forbid = false) {
    if (forbid === true) this.autoResolutionPossible = false

    this.autoResolution = false
    this.trigger('autoResolutionChange', { possible: this.autoResolutionPossible })
    this.trigger('resolutionChange', { auto: this.autoResolution, resolutionId: this.getCurrentResolutionId() })
  }

  isAutoResolutionPossible () {
    return this.autoResolutionPossible
  }

  getTorrent () {
    return this.torrent
  }

  getCurrentVideoFile () {
    return this.currentVideoFile
  }

  private addTorrent (
    magnetOrTorrentUrl: string,
    previousVideoFile: VideoFile,
    options: PlayOptions,
    done: Function
  ) {
    console.log('Adding ' + magnetOrTorrentUrl + '.')

    const oldTorrent = this.torrent
    const torrentOptions = {
      // Don't use arrow function: it breaks webtorrent (that uses `new` keyword)
      store: function (chunkLength: number, storeOpts: any) {
        return new CacheChunkStore(new PeertubeChunkStore(chunkLength, storeOpts), {
          max: 100
        })
      }
    }

    this.torrent = this.webtorrent.add(magnetOrTorrentUrl, torrentOptions, torrent => {
      console.log('Added ' + magnetOrTorrentUrl + '.')

      if (oldTorrent) {
        // Pause the old torrent
        this.stopTorrent(oldTorrent)

        // We use a fake renderer so we download correct pieces of the next file
        if (options.delay) this.renderFileInFakeElement(torrent.files[ 0 ], options.delay)
      }

      // Render the video in a few seconds? (on resolution change for example, we wait some seconds of the new video resolution)
      this.addTorrentDelay = setTimeout(() => {
        // We don't need the fake renderer anymore
        this.destroyFakeRenderer()

        const paused = this.player.paused()

        this.flushVideoFile(previousVideoFile)

        // Update progress bar (just for the UI), do not wait rendering
        if (options.seek) this.player.currentTime(options.seek)

        const renderVideoOptions = { autoplay: false, controls: true }
        renderVideo(torrent.files[ 0 ], this.playerElement, renderVideoOptions, (err, renderer) => {
          this.renderer = renderer

          if (err) return this.fallbackToHttp(options, done)

          return this.tryToPlay(err => {
            if (err) return done(err)

            if (options.seek) this.seek(options.seek)
            if (options.forcePlay === false && paused === true) this.player.pause()

            return done()
          })
        })
      }, options.delay || 0)
    })

    this.torrent.on('error', (err: any) => console.error(err))

    this.torrent.on('warning', (err: any) => {
      // We don't support HTTP tracker but we don't care -> we use the web socket tracker
      if (err.message.indexOf('Unsupported tracker protocol') !== -1) return

      // Users don't care about issues with WebRTC, but developers do so log it in the console
      if (err.message.indexOf('Ice connection failed') !== -1) {
        console.log(err)
        return
      }

      // Magnet hash is not up to date with the torrent file, add directly the torrent file
      if (err.message.indexOf('incorrect info hash') !== -1) {
        console.error('Incorrect info hash detected, falling back to torrent file.')
        const newOptions = { forcePlay: true, seek: options.seek }
        return this.addTorrent(this.torrent[ 'xs' ], previousVideoFile, newOptions, done)
      }

      // Remote instance is down
      if (err.message.indexOf('from xs param') !== -1) {
        this.handleError(err)
      }

      console.warn(err)
    })
  }

  private tryToPlay (done?: (err?: Error) => void) {
    if (!done) done = function () { /* empty */ }

    // Try in mute mode because we have issues with Safari
    if (isSafari() && this.player.muted() === false) {
      this.player.muted(true)
    }

    const playPromise = this.player.play()
    if (playPromise !== undefined) {
      return playPromise.then(() => done())
                        .catch((err: Error) => {
                          if (err.message.indexOf('The play() request was interrupted by a call to pause()') !== -1) {
                            return
                          }

                          console.error(err)
                          this.player.pause()
                          this.player.posterImage.show()
                          this.player.removeClass('vjs-has-autoplay')
                          this.player.removeClass('vjs-has-big-play-button-clicked')
                          this.player.removeClass('vjs-playing-audio-only-content')

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
    if (this.videoFiles === undefined) return undefined

    const files = this.videoFiles.filter(f => f.resolution.id !== 0)

    if (files.length === 0) return undefined
    if (files.length === 1) return files[0]

    // Don't change the torrent is the play was ended
    if (this.torrent && this.torrent.progress === 1 && this.player.ended()) return this.currentVideoFile

    if (!averageDownloadSpeed) averageDownloadSpeed = this.getAndSaveActualDownloadSpeed()
    averageDownloadSpeed = 0

    // Limit resolution according to player height
    const playerHeight = this.playerElement.offsetHeight

    // We take the first resolution just above the player height
    // Example: player height is 530px, we want the 720p file instead of 480p
    let maxResolution = files[0].resolution.id
    for (let i = files.length - 1; i >= 0; i--) {
      const resolutionId = files[i].resolution.id
      if (resolutionId !== 0 && resolutionId >= playerHeight) {
        maxResolution = resolutionId
        break
      }
    }

    // Filter videos we can play according to our screen resolution and bandwidth
    const filteredFiles = files.filter(f => f.resolution.id <= maxResolution)
                               .filter(f => {
                                 const fileBitrate = (f.size / this.videoDuration)
                                 let threshold = fileBitrate

                                 // If this is for a higher resolution or an initial load: add a margin
                                 if (!this.currentVideoFile || f.resolution.id > this.currentVideoFile.resolution.id) {
                                   threshold += ((fileBitrate * this.CONSTANTS.AUTO_QUALITY_THRESHOLD_PERCENT) / 100)
                                 }

                                 return averageDownloadSpeed > threshold
                               })

    // If the download speed is too bad, return the lowest resolution we have
    if (filteredFiles.length === 0) return videoFileMinByResolution(files)

    return videoFileMaxByResolution(filteredFiles)
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
    this.buildQualities()

    if (this.autoplay) {
      this.player.posterImage.hide()

      return this.updateVideoFile(undefined, { forcePlay: true, seek: this.startTime })
    }

    // Proxy first play
    const oldPlay = this.player.play.bind(this.player);
    (this.player as any).play = () => {
      this.player.addClass('vjs-has-big-play-button-clicked')
      this.player.play = oldPlay

      this.updateVideoFile(undefined, { forcePlay: true, seek: this.startTime })
    }
  }

  private runAutoQualityScheduler () {
    this.autoQualityInterval = setInterval(() => {

      // Not initialized or in HTTP fallback
      if (this.torrent === undefined || this.torrent === null) return
      if (this.autoResolution === false) return
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
      if (this.torrent === null) return this.player.trigger('p2pInfo', false)

      // this.webtorrent.downloadSpeed because we need to take into account the potential old torrent too
      if (this.webtorrent.downloadSpeed !== 0) this.downloadSpeeds.push(this.webtorrent.downloadSpeed)

      return this.player.trigger('p2pInfo', {
        http: {
          downloadSpeed: 0,
          uploadSpeed: 0,
          downloaded: 0,
          uploaded: 0
        },
        p2p: {
          downloadSpeed: this.torrent.downloadSpeed,
          numPeers: this.torrent.numPeers,
          uploadSpeed: this.torrent.uploadSpeed,
          downloaded: this.torrent.downloaded,
          uploaded: this.torrent.uploaded
        }
      } as PlayerNetworkInfo)
    }, this.CONSTANTS.INFO_SCHEDULER)
  }

  private fallbackToHttp (options: PlayOptions, done?: Function) {
    const paused = this.player.paused()

    this.disableAutoResolution(true)

    this.flushVideoFile(this.currentVideoFile, true)
    this.torrent = null

    // Enable error display now this is our last fallback
    this.player.one('error', () => this.enableErrorDisplay())

    const httpUrl = this.currentVideoFile.fileUrl
    this.player.src = this.savePlayerSrcFunction
    this.player.src(httpUrl)

    this.changeQuality()

    // We changed the source, so reinit captions
    this.player.trigger('sourcechange')

    return this.tryToPlay(err => {
      if (err && done) return done(err)

      if (options.seek) this.seek(options.seek)
      if (options.forcePlay === false && paused === true) this.player.pause()

      if (done) return done()
    })
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

  private pickAverageVideoFile () {
    if (this.videoFiles.length === 1) return this.videoFiles[0]

    return this.videoFiles[Math.floor(this.videoFiles.length / 2)]
  }

  private stopTorrent (torrent: WebTorrent.Torrent) {
    torrent.pause()
    // Pause does not remove actual peers (in particular the webseed peer)
    torrent.removePeer(torrent[ 'ws' ])
  }

  private renderFileInFakeElement (file: WebTorrent.TorrentFile, delay: number) {
    this.destroyingFakeRenderer = false

    const fakeVideoElem = document.createElement('video')
    renderVideo(file, fakeVideoElem, { autoplay: false, controls: false }, (err, renderer) => {
      this.fakeRenderer = renderer

      // The renderer returns an error when we destroy it, so skip them
      if (this.destroyingFakeRenderer === false && err) {
        console.error('Cannot render new torrent in fake video element.', err)
      }

      // Load the future file at the correct time (in delay MS - 2 seconds)
      fakeVideoElem.currentTime = this.player.currentTime() + (delay - 2000)
    })
  }

  private destroyFakeRenderer () {
    if (this.fakeRenderer) {
      this.destroyingFakeRenderer = true

      if (this.fakeRenderer.destroy) {
        try {
          this.fakeRenderer.destroy()
        } catch (err) {
          console.log('Cannot destroy correctly fake renderer.', err)
        }
      }
      this.fakeRenderer = undefined
    }
  }

  private buildQualities () {
    const qualityLevelsPayload = []

    for (const file of this.videoFiles) {
      const representation = {
        id: file.resolution.id,
        label: this.buildQualityLabel(file),
        height: file.resolution.id,
        _enabled: true
      }

      this.player.qualityLevels().addQualityLevel(representation)

      qualityLevelsPayload.push({
        id: representation.id,
        label: representation.label,
        selected: false
      })
    }

    const payload: LoadedQualityData = {
      qualitySwitchCallback: (d: any) => this.qualitySwitchCallback(d),
      qualityData: {
        video: qualityLevelsPayload
      }
    }
    this.player.tech(true).trigger('loadedqualitydata', payload)
  }

  private buildQualityLabel (file: VideoFile) {
    let label = file.resolution.label

    if (file.fps && file.fps >= 50) {
      label += file.fps
    }

    return label
  }

  private qualitySwitchCallback (id: number) {
    if (id === -1) {
      if (this.autoResolutionPossible === true) this.enableAutoResolution()
      return
    }

    this.disableAutoResolution()
    this.updateResolution(id)
  }

  private changeQuality () {
    const resolutionId = this.currentVideoFile.resolution.id
    const qualityLevels = this.player.qualityLevels()

    if (resolutionId === -1) {
      qualityLevels.selectedIndex = -1
      return
    }

    for (let i = 0; i < qualityLevels.length; i++) {
      const q = qualityLevels[i]
      if (q.height === resolutionId) qualityLevels.selectedIndex_ = i
    }
  }
}

videojs.registerPlugin('webtorrent', WebTorrentPlugin)
export { WebTorrentPlugin }
