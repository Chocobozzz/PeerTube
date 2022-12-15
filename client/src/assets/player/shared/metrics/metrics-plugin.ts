import videojs from 'video.js'
import { PlaybackMetricCreate } from '../../../../../../shared/models'
import { MetricsPluginOptions, PlayerMode, PlayerNetworkInfo } from '../../types'

const Plugin = videojs.getPlugin('plugin')

class MetricsPlugin extends Plugin {
  private readonly metricsUrl: string
  private readonly videoUUID: string
  private readonly mode: PlayerMode

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

    this.metricsUrl = options.metricsUrl
    this.videoUUID = options.videoUUID
    this.mode = options.mode

    this.player.one('play', () => {
      this.runMetricsInterval()

      this.trackBytes()
      this.trackResolutionChange()
      this.trackErrors()
    })
  }

  dispose () {
    if (this.metricsInterval) clearInterval(this.metricsInterval)
  }

  private runMetricsInterval () {
    this.metricsInterval = setInterval(() => {
      let resolution: number
      let fps: number

      if (this.mode === 'p2p-media-loader') {
        const level = this.player.p2pMediaLoader().getCurrentLevel()
        if (!level) return

        resolution = Math.min(level.height || 0, level.width || 0)

        const framerate = level?.attrs['FRAME-RATE']
        fps = framerate
          ? parseInt(framerate, 10)
          : undefined
      } else { // webtorrent
        const videoFile = this.player.webtorrent().getCurrentVideoFile()
        if (!videoFile) return

        resolution = videoFile.resolution.id
        fps = videoFile.fps && videoFile.fps !== -1
          ? videoFile.fps
          : undefined
      }

      const body: PlaybackMetricCreate = {
        resolution,
        fps,

        playerMode: this.mode,

        resolutionChanges: this.resolutionChanges,

        errors: this.errors,

        downloadedBytesP2P: this.downloadedBytesP2P,
        downloadedBytesHTTP: this.downloadedBytesHTTP,

        uploadedBytesP2P: this.uploadedBytesP2P,

        videoId: this.videoUUID
      }

      this.resolutionChanges = 0

      this.downloadedBytesP2P = 0
      this.downloadedBytesHTTP = 0

      this.uploadedBytesP2P = 0

      this.errors = 0

      const headers = new Headers({ 'Content-type': 'application/json; charset=UTF-8' })

      return fetch(this.metricsUrl, { method: 'POST', body: JSON.stringify(body), headers })
    }, this.CONSTANTS.METRICS_INTERVAL)
  }

  private trackBytes () {
    this.player.on('p2pInfo', (_event, data: PlayerNetworkInfo) => {
      if (!data) return

      this.downloadedBytesHTTP += data.http.downloaded - (this.lastPlayerNetworkInfo?.http.downloaded || 0)
      this.downloadedBytesP2P += data.p2p.downloaded - (this.lastPlayerNetworkInfo?.p2p.downloaded || 0)

      this.uploadedBytesP2P += data.p2p.uploaded - (this.lastPlayerNetworkInfo?.p2p.uploaded || 0)

      this.lastPlayerNetworkInfo = data
    })
  }

  private trackResolutionChange () {
    this.player.on('engineResolutionChange', () => {
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
