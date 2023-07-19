import debug from 'debug'
import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { PlaybackMetricCreate } from '../../../../../../shared/models'
import { MetricsPluginOptions, PlayerNetworkInfo } from '../../types'

const debugLogger = debug('peertube:player:metrics')

const Plugin = videojs.getPlugin('plugin')

class MetricsPlugin extends Plugin {
  options_: MetricsPluginOptions

  private downloadedBytesP2P = 0
  private downloadedBytesHTTP = 0
  private uploadedBytesP2P = 0

  private resolutionChanges = 0
  private errors = 0

  private lastPlayerNetworkInfo: PlayerNetworkInfo

  private metricsInterval: any

  private readonly CONSTANTS = {
    METRICS_INTERVAL: 15000
  }

  constructor (player: videojs.Player, options: MetricsPluginOptions) {
    super(player)

    this.options_ = options

    this.trackBytes()
    this.trackResolutionChange()
    this.trackErrors()

    this.one('play', () => {
      this.player.on('video-change', () => {
        this.runMetricsIntervalOnPlay()
      })
    })

    this.runMetricsIntervalOnPlay()
  }

  dispose () {
    if (this.metricsInterval) clearInterval(this.metricsInterval)

    super.dispose()
  }

  private runMetricsIntervalOnPlay () {
    this.downloadedBytesP2P = 0
    this.downloadedBytesHTTP = 0
    this.uploadedBytesP2P = 0

    this.resolutionChanges = 0
    this.errors = 0

    this.lastPlayerNetworkInfo = undefined

    debugLogger('Will track metrics on next play')

    this.player.one('play', () => {
      debugLogger('Tracking metrics')

      this.runMetricsInterval()
    })
  }

  private runMetricsInterval () {
    if (this.metricsInterval) clearInterval(this.metricsInterval)

    this.metricsInterval = setInterval(() => {
      let resolution: number
      let fps: number

      if (this.player.usingPlugin('p2pMediaLoader')) {
        const level = this.player.p2pMediaLoader().getCurrentLevel()
        if (!level) return

        resolution = Math.min(level.height || 0, level.width || 0)

        const framerate = level?.attrs['FRAME-RATE']
        fps = framerate
          ? parseInt(framerate, 10)
          : undefined
      } else if (this.player.usingPlugin('webVideo')) {
        const videoFile = this.player.webVideo().getCurrentVideoFile()
        if (!videoFile) return

        resolution = videoFile.resolution.id
        fps = videoFile.fps && videoFile.fps !== -1
          ? videoFile.fps
          : undefined
      } else {
        return
      }

      const body: PlaybackMetricCreate = {
        resolution,
        fps,

        playerMode: this.options_.mode(),

        resolutionChanges: this.resolutionChanges,

        errors: this.errors,

        downloadedBytesP2P: this.downloadedBytesP2P,
        downloadedBytesHTTP: this.downloadedBytesHTTP,

        uploadedBytesP2P: this.uploadedBytesP2P,

        videoId: this.options_.videoUUID()
      }

      this.resolutionChanges = 0

      this.downloadedBytesP2P = 0
      this.downloadedBytesHTTP = 0

      this.uploadedBytesP2P = 0

      this.errors = 0

      const headers = new Headers({ 'Content-type': 'application/json; charset=UTF-8' })

      return fetch(this.options_.metricsUrl(), { method: 'POST', body: JSON.stringify(body), headers })
        .catch(err => logger.error('Cannot send metrics to the server.', err))
    }, this.CONSTANTS.METRICS_INTERVAL)
  }

  private trackBytes () {
    this.player.on('p2p-info', (_event, data: PlayerNetworkInfo) => {
      this.downloadedBytesHTTP += Math.round(data.http.downloaded - (this.lastPlayerNetworkInfo?.http.downloaded || 0))
      this.downloadedBytesP2P += Math.round(data.p2p.downloaded - (this.lastPlayerNetworkInfo?.p2p.downloaded || 0))

      this.uploadedBytesP2P += Math.round(data.p2p.uploaded - (this.lastPlayerNetworkInfo?.p2p.uploaded || 0))

      this.lastPlayerNetworkInfo = data
    })

    this.player.on('http-info', (_event, data: PlayerNetworkInfo) => {
      this.downloadedBytesHTTP += Math.round(data.http.downloaded - (this.lastPlayerNetworkInfo?.http.downloaded || 0))

      this.lastPlayerNetworkInfo = data
    })
  }

  private trackResolutionChange () {
    this.player.on('engine-resolution-change', () => {
      this.resolutionChanges++
    })

    this.player.on('user-resolution-change', () => {
      this.resolutionChanges++
    })
  }

  private trackErrors () {
    this.player.on('error', () => {
      this.errors++
    })
  }
}

videojs.registerPlugin('metrics', MetricsPlugin)
export { MetricsPlugin }
