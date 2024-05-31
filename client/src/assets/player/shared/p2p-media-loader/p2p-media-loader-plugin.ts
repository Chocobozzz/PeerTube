import Hlsjs from 'hls.js'
import videojs from 'video.js'
import { Events, Segment } from '@peertube/p2p-media-loader-core'
import { Engine, initHlsJsPlayer, initVideoJsContribHlsJsPlayer } from '@peertube/p2p-media-loader-hlsjs'
import { logger } from '@root-helpers/logger'
import { addQueryParams } from '@peertube/peertube-core-utils'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo } from '../../types'
import { SettingsButton } from '../settings/settings-menu-button'

const Plugin = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {
  private readonly options: P2PMediaLoaderPluginOptions

  private hlsjs: Hlsjs
  private p2pEngine: Engine
  private statsP2PBytes = {
    pendingDownload: [] as number[],
    pendingUpload: [] as number[],
    peersWithWebSeed: 0,
    peersP2POnly: 0,
    totalDownload: 0,
    totalUpload: 0
  }
  private statsHTTPBytes = {
    pendingDownload: [] as number[],
    totalDownload: 0
  }

  private networkInfoInterval: any

  constructor (player: videojs.Player, options?: P2PMediaLoaderPluginOptions) {
    super(player)

    this.options = options

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
      this.initializePlugin()
    })
  }

  dispose () {
    this.p2pEngine?.removeAllListeners()
    this.p2pEngine?.destroy()

    this.hlsjs?.destroy()
    this.options.segmentValidator?.destroy();

    (videojs as any).Html5Hlsjs?.removeAllHooks()

    clearInterval(this.networkInfoInterval)

    super.dispose()
  }

  // ---------------------------------------------------------------------------

  getCurrentLevel () {
    if (!this.hlsjs) return undefined

    return this.hlsjs.levels[this.hlsjs.currentLevel]
  }

  // ---------------------------------------------------------------------------

  getLiveLatency () {
    return Math.round(this.hlsjs.latency)
  }

  getLiveLatencyFromEdge () {
    return Math.round(this.hlsjs.latency - this.hlsjs.targetLatency)
  }

  // ---------------------------------------------------------------------------

  getHLSJS () {
    return this.hlsjs
  }

  private initializePlugin () {
    initHlsJsPlayer(this.hlsjs)

    this.p2pEngine = this.options.loader.getEngine()

    this.p2pEngine.on(Events.SegmentError, (segment: Segment, err) => {
      if (navigator.onLine === false) return

      logger.error(`Segment ${segment.id} error.`, err)

      if (this.options.redundancyUrlManager) {
        this.options.redundancyUrlManager.removeBySegmentUrl(segment.requestUrl)
      }
    })

    const redundancyUrlsCount = this.options.redundancyUrlManager
      ? this.options.redundancyUrlManager.countBaseUrls()
      : 0

    this.statsP2PBytes.peersWithWebSeed = 1 + redundancyUrlsCount

    this.runStats()

    let initResolutionChange = true
    this.hlsjs.on(Hlsjs.Events.LEVEL_SWITCHED, () => {
      const level = this.getCurrentLevel()
      const resolution = Math.min(level?.height || 0, level?.width || 0)

      this.player.trigger('resolution-change', { resolution, initResolutionChange })
      initResolutionChange = false
    })

    this.hlsjs.on(Hlsjs.Events.MANIFEST_PARSED, (_event, data) => {
      if (Array.isArray(data.levels) && data.levels.length >= 1) {
        const level = data.levels[0]

        this.player.trigger('video-ratio-changed', { ratio: level.width / level.height })
      }
    })
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

    this.p2pEngine.on(Events.PeerConnect, () => {
      this.statsP2PBytes.peersWithWebSeed++
      this.statsP2PBytes.peersP2POnly++
    })
    this.p2pEngine.on(Events.PeerClose, () => {
      this.statsP2PBytes.peersWithWebSeed--
      this.statsP2PBytes.peersP2POnly--
    })

    this.networkInfoInterval = setInterval(() => {
      const p2pDownloadSpeed = this.arraySum(this.statsP2PBytes.pendingDownload)
      const p2pUploadSpeed = this.arraySum(this.statsP2PBytes.pendingUpload)

      const httpDownloadSpeed = this.arraySum(this.statsHTTPBytes.pendingDownload)

      this.statsP2PBytes.pendingDownload = []
      this.statsP2PBytes.pendingUpload = []
      this.statsHTTPBytes.pendingDownload = []

      return this.player.trigger('network-info', {
        source: 'p2p-media-loader',
        bandwidthEstimate: (this.hlsjs as any).bandwidthEstimate / 8,
        http: {
          downloadSpeed: httpDownloadSpeed,
          downloaded: this.statsHTTPBytes.totalDownload
        },
        p2p: this.options.p2pEnabled
          ? {
            downloadSpeed: p2pDownloadSpeed,
            uploadSpeed: p2pUploadSpeed,
            peersWithWebSeed: this.statsP2PBytes.peersWithWebSeed,
            peersP2POnly: this.statsP2PBytes.peersP2POnly,
            downloaded: this.statsP2PBytes.totalDownload,
            uploaded: this.statsP2PBytes.totalUpload
          }
          : undefined
      } as PlayerNetworkInfo)
    }, 1000)
  }

  private arraySum (data: number[]) {
    return data.reduce((a: number, b: number) => a + b, 0)
  }

  private fallbackToBuiltInIOS () {
    logger.info('HLS.js does not seem to be supported. Fallback to built-in HLS.')

    this.player.src({
      type: this.options.type,
      src: addQueryParams(this.options.src, {
        videoFileToken: this.options.videoFileToken(),
        reinjectVideoFileToken: 'true'
      })
    })

    // Resolution button is not supported in built-in HLS player
    this.getResolutionButton().hide()
  }

  private getResolutionButton () {
    const settingsButton = this.player.controlBar.getDescendant([ 'settingsButton' ]) as SettingsButton

    return settingsButton.menu.getChild('resolutionMenuButton')
  }
}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
