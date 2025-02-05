import { addQueryParams, getResolutionAndFPSLabel } from '@peertube/peertube-core-utils'
import { VideoFile } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import videojs from 'video.js'
import { PeerTubeResolution, PlayerNetworkInfo, WebVideoPluginOptions } from '../../types'

const debugLogger = debug('peertube:player:web-video-plugin')

const Plugin = videojs.getPlugin('plugin')

class WebVideoPlugin extends Plugin {
  declare private readonly videoFiles: VideoFile[]

  declare private currentVideoFile: VideoFile
  declare private videoFileToken: () => string

  declare private networkInfoInterval: any

  declare private onErrorHandler: () => void
  declare private onPlayHandler: () => void
  declare private onLoadedMetadata: () => void

  constructor (player: videojs.Player, options?: WebVideoPluginOptions) {
    super(player, options)

    this.videoFiles = options.videoFiles
    this.videoFileToken = options.videoFileToken

    const videoFile = this.pickAverageVideoFile()
    if (videoFile) this.updateVideoFile({ videoFile, isUserResolutionChange: false })

    this.onLoadedMetadata = () => {
      player.trigger('video-ratio-changed', { ratio: this.player.videoWidth() / this.player.videoHeight() })
    }

    player.on('loadedmetadata', this.onLoadedMetadata)

    player.ready(() => {
      if (this.videoFiles.length === 0) {
        this.player.addClass('disabled')
        return
      }

      this.buildQualities()

      this.setupNetworkInfoInterval()
    })
  }

  dispose () {
    if (this.networkInfoInterval) clearInterval(this.networkInfoInterval)

    if (this.onLoadedMetadata) this.player.off('loadedmetadata', this.onLoadedMetadata)
    if (this.onErrorHandler) this.player.off('error', this.onErrorHandler)
    if (this.onPlayHandler) this.player.off('canplay', this.onPlayHandler)

    super.dispose()
  }

  getCurrentResolutionId () {
    return this.currentVideoFile?.resolution.id
  }

  updateVideoFile (options: {
    videoFile: VideoFile
    isUserResolutionChange: boolean
  }) {
    this.currentVideoFile = options.videoFile

    debugLogger('Updating web video file to ' + this.currentVideoFile.fileUrl)

    const paused = this.player.paused()
    const playbackRate = this.player.playbackRate()
    const currentTime = this.player.currentTime()

    if (!this.onErrorHandler) {
      this.onErrorHandler = () => this.player.peertube().displayFatalError()
      this.player.one('error', this.onErrorHandler)
    }

    let httpUrl = this.currentVideoFile.fileUrl

    if (this.videoFileToken()) {
      httpUrl = addQueryParams(httpUrl, { videoFileToken: this.videoFileToken() })
    }

    const oldAutoplayValue = this.player.autoplay()
    if (options.isUserResolutionChange) {
      this.player.autoplay(false)
      this.player.addClass('vjs-updating-resolution')
    }

    this.player.src(httpUrl)

    this.onPlayHandler = () => {
      this.player.playbackRate(playbackRate)
      this.player.currentTime(currentTime)

      this.player.trigger('resolution-change', {
        resolution: this.currentVideoFile?.resolution.id,
        initResolutionChange: !options.isUserResolutionChange
      })

      if (options.isUserResolutionChange) {
        this.player.trigger('web-video-source-change')

        this.tryToPlay()
          .then(() => {
            if (paused) this.player.pause()

            this.player.autoplay(oldAutoplayValue)
          })
      }
    }

    this.player.one('canplay', this.onPlayHandler)
  }

  getCurrentVideoFile () {
    return this.currentVideoFile
  }

  private tryToPlay () {
    debugLogger('Try to play manually the video')

    const playPromise = this.player.play()
    if (playPromise === undefined) return

    return playPromise
      .catch((err: Error) => {
        if (err.message.includes('The play() request was interrupted by a call to pause()')) {
          return
        }

        logger.warn(err)
        this.player.pause()
        this.player.posterImage.show()
        this.player.removeClass('vjs-has-autoplay')
        this.player.removeClass('vjs-playing-audio-only-content')
      })
      .finally(() => {
        this.player.removeClass('vjs-updating-resolution')
      })
  }

  private pickAverageVideoFile () {
    if (!this.videoFiles || this.videoFiles.length === 0) return undefined
    if (this.videoFiles.length === 1) return this.videoFiles[0]

    const files = this.videoFiles.filter(f => f.resolution.id !== 0)
    return files[Math.floor(files.length / 2)]
  }

  private buildQualities () {
    const resolutions: PeerTubeResolution[] = this.videoFiles.map(videoFile => ({
      id: videoFile.resolution.id,
      label: this.player.localize(getResolutionAndFPSLabel(videoFile.resolution.label, videoFile.fps)),
      height: videoFile.resolution.id,
      selected: videoFile.id === this.currentVideoFile?.id,
      selectCallback: () => this.updateVideoFile({ videoFile, isUserResolutionChange: true })
    }))

    this.player.peertubeResolutions().add(resolutions)
  }

  private setupNetworkInfoInterval () {
    this.networkInfoInterval = setInterval(() => {
      return this.player.trigger('network-info', {
        source: 'web-video',
        http: {
          downloaded: this.player.bufferedPercent() * this.currentVideoFile?.size
        }
      } as PlayerNetworkInfo)
    }, 1000)
  }
}

videojs.registerPlugin('webVideo', WebVideoPlugin)
export { WebVideoPlugin }
