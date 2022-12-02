import Hlsjs from 'hls.js'
import videojs from 'video.js'
import { Events, Segment } from '@peertube/p2p-media-loader-core'
import { Engine, initHlsJsPlayer, initVideoJsContribHlsJsPlayer } from '@peertube/p2p-media-loader-hlsjs'
import { logger } from '@root-helpers/logger'
import { addQueryParams, timeToInt } from '@shared/core-utils'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo } from '../../types'
import { registerConfigPlugin, registerSourceHandler } from './hls-plugin'

registerConfigPlugin(videojs)
registerSourceHandler(videojs)

const Plugin = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {

  private readonly CONSTANTS = {
    INFO_SCHEDULER: 1000 // Don't change this
  }
  private readonly options: P2PMediaLoaderPluginOptions

  private hlsjs: Hlsjs
  private p2pEngine: Engine
  private statsP2PBytes = {
    pendingDownload: [] as number[],
    pendingUpload: [] as number[],
    numPeers: 0,
    totalDownload: 0,
    totalUpload: 0
  }
  private statsHTTPBytes = {
    pendingDownload: [] as number[],
    totalDownload: 0
  }
  private startTime: number

  private networkInfoInterval: any

  constructor (player: videojs.Player, options?: P2PMediaLoaderPluginOptions) {
    super(player)

    this.options = options
    this.startTime = timeToInt(options.startTime)

    // FIXME: typings https://github.com/Microsoft/TypeScript/issues/14080
    if (!(videojs as any).Html5Hlsjs) {
      if (player.canPlayType('application/vnd.apple.mpegurl')) {
        this.fallbackToBuiltInIOS()
        return
      }

      const message = 'HLS.js does not seem to be supported. Cannot fallback to built-in HLS'
      logger.warn(message)

      const error: MediaError = {
        code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
        message,
        MEDIA_ERR_ABORTED: MediaError.MEDIA_ERR_ABORTED,
        MEDIA_ERR_DECODE: MediaError.MEDIA_ERR_DECODE,
        MEDIA_ERR_NETWORK: MediaError.MEDIA_ERR_NETWORK,
        MEDIA_ERR_SRC_NOT_SUPPORTED: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      }

      player.ready(() => player.error(error))
      return
    }

    // FIXME: typings https://github.com/Microsoft/TypeScript/issues/14080
    (videojs as any).Html5Hlsjs.addHook('beforeinitialize', (_videojsPlayer: any, hlsjs: any) => {
      this.hlsjs = hlsjs
    })

    initVideoJsContribHlsJsPlayer(player)

    player.src({
      type: options.type,
      src: options.src
    })

    player.ready(() => {
      this.initializeCore()

      this.initializePlugin()
    })
  }

  dispose () {
    if (this.hlsjs) this.hlsjs.destroy()
    if (this.p2pEngine) this.p2pEngine.destroy()

    clearInterval(this.networkInfoInterval)
  }

  getCurrentLevel () {
    if (!this.hlsjs) return undefined

    return this.hlsjs.levels[this.hlsjs.currentLevel]
  }

  getLiveLatency () {
    return Math.round(this.hlsjs.latency)
  }

  getHLSJS () {
    return this.hlsjs
  }

  private initializeCore () {
    this.player.one('play', () => {
      this.player.addClass('vjs-has-big-play-button-clicked')
    })

    this.player.one('canplay', () => {
      if (this.startTime) {
        this.player.currentTime(this.startTime)
      }
    })
  }

  private initializePlugin () {
    initHlsJsPlayer(this.hlsjs)

    this.p2pEngine = this.options.loader.getEngine()

    this.p2pEngine.on(Events.SegmentError, (segment: Segment, err) => {
      if (navigator.onLine === false) return

      logger.error(`Segment ${segment.id} error.`, err)

      this.options.redundancyUrlManager.removeBySegmentUrl(segment.requestUrl)
    })

    this.statsP2PBytes.numPeers = 1 + this.options.redundancyUrlManager.countBaseUrls()

    this.runStats()

    this.hlsjs.on(Hlsjs.Events.LEVEL_SWITCHED, () => this.player.trigger('engineResolutionChange'))
  }

  private runStats () {
    this.p2pEngine.on(Events.PieceBytesDownloaded, (method: string, _segment, bytes: number) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingDownload.push(bytes)
      elem.totalDownload += bytes
    })

    this.p2pEngine.on(Events.PieceBytesUploaded, (method: string, _segment, bytes: number) => {
      if (method !== 'p2p') {
        logger.error(`Received upload from unknown method ${method}`)
        return
      }

      this.statsP2PBytes.pendingUpload.push(bytes)
      this.statsP2PBytes.totalUpload += bytes
    })

    this.p2pEngine.on(Events.PeerConnect, () => this.statsP2PBytes.numPeers++)
    this.p2pEngine.on(Events.PeerClose, () => this.statsP2PBytes.numPeers--)

    this.networkInfoInterval = setInterval(() => {
      const p2pDownloadSpeed = this.arraySum(this.statsP2PBytes.pendingDownload)
      const p2pUploadSpeed = this.arraySum(this.statsP2PBytes.pendingUpload)

      const httpDownloadSpeed = this.arraySum(this.statsHTTPBytes.pendingDownload)

      this.statsP2PBytes.pendingDownload = []
      this.statsP2PBytes.pendingUpload = []
      this.statsHTTPBytes.pendingDownload = []

      return this.player.trigger('p2pInfo', {
        source: 'p2p-media-loader',
        http: {
          downloadSpeed: httpDownloadSpeed,
          downloaded: this.statsHTTPBytes.totalDownload
        },
        p2p: {
          downloadSpeed: p2pDownloadSpeed,
          uploadSpeed: p2pUploadSpeed,
          numPeers: this.statsP2PBytes.numPeers,
          downloaded: this.statsP2PBytes.totalDownload,
          uploaded: this.statsP2PBytes.totalUpload
        },
        bandwidthEstimate: (this.hlsjs as any).bandwidthEstimate / 8
      } as PlayerNetworkInfo)
    }, this.CONSTANTS.INFO_SCHEDULER)
  }

  private arraySum (data: number[]) {
    return data.reduce((a: number, b: number) => a + b, 0)
  }

  private fallbackToBuiltInIOS () {
    logger.info('HLS.js does not seem to be supported. Fallback to built-in HLS.');

    // Workaround to force video.js to not re create a video element
    (this.player as any).playerElIngest_ = this.player.el().parentNode

    this.player.src({
      type: this.options.type,
      src: addQueryParams(this.options.src, {
        videoFileToken: this.options.videoFileToken(),
        reinjectVideoFileToken: 'true'
      })
    })

    this.player.ready(() => {
      this.initializeCore()
    })
  }
}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
