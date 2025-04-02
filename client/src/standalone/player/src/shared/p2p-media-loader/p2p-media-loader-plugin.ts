import { addQueryParams } from '@peertube/peertube-core-utils'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { FragLoadedData, default as Hlsjs } from 'hls.js'
import type { DownloadSource, SegmentErrorDetails, SegmentLoadDetails } from 'p2p-media-loader-core'
import type { HlsWithP2PInstance } from 'p2p-media-loader-hlsjs'
import videojs from 'video.js'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo } from '../../types'
import { SettingsButton } from '../settings/settings-menu-button'

const debugLogger = debug('peertube:player:p2p-media-loader')

const Plugin = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {
  declare private readonly options: P2PMediaLoaderPluginOptions

  declare private hlsjs: HlsWithP2PInstance<Hlsjs>
  declare private statsP2PBytes: {
    pendingDownload: number[]
    pendingUpload: number[]
    peersWithWebSeed: number
    peersP2POnly: number
    totalDownload: number
    totalUpload: number
  }
  declare private statsHTTPBytes: {
    pendingDownload: number[]
    totalDownload: number
  }

  declare private networkInfoInterval: any

  declare private liveEnded: boolean

  declare private connectedPeers: Set<string>
  declare private totalHTTPPeers: number

  constructor (player: videojs.Player, options?: P2PMediaLoaderPluginOptions) {
    super(player)

    this.options = options

    this.statsP2PBytes = {
      pendingDownload: [] as number[],
      pendingUpload: [] as number[],
      peersWithWebSeed: 0,
      peersP2POnly: 0,
      totalDownload: 0,
      totalUpload: 0
    }
    this.statsHTTPBytes = {
      pendingDownload: [] as number[],
      totalDownload: 0
    }
    this.liveEnded = false

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

    {
      const onHLSJSInitialized = (_: any, { hlsjs }: { hlsjs: HlsWithP2PInstance<Hlsjs> }) => {
        this.hlsjs?.p2pEngine?.destroy()
        clearInterval(this.networkInfoInterval)

        this.hlsjs = hlsjs

        debugLogger('hls.js initialized, initializing p2p-media-loader plugin', { hlsjs })

        player.ready(() => this.initializePlugin())
      }

      player.on('hlsjs-initialized', onHLSJSInitialized)

      // ---------------------------------------------------------------------------

      const onHLSJSLiveEnded = () => {
        debugLogger('hls.js says the live is ended')

        this.liveEnded = true
      }

      player.on('hlsjs-live-ended', onHLSJSLiveEnded)

      // ---------------------------------------------------------------------------

      this.on('dispose', () => {
        this.player.off('hlsjs-initialized', onHLSJSInitialized)
        this.player.off('hlsjs-live-ended', onHLSJSLiveEnded)
      })
    }

    player.src({
      type: options.type,
      src: options.src
    })
  }

  dispose () {
    this.hlsjs?.p2pEngine?.destroy()

    this.hlsjs?.destroy()
    this.options.segmentValidator?.destroy()

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
    this.hlsjs.p2pEngine.addEventListener('onSegmentError', (details: SegmentErrorDetails) => {
      if (navigator.onLine === false || this.liveEnded || details.downloadSource !== 'http') return

      const segment = details.segment
      logger.clientError(`Segment ${segment.runtimeId} error.`, details)

      if (this.options.redundancyUrlManager) {
        this.options.redundancyUrlManager.onSegmentError(segment.url)
      }
    })

    this.hlsjs.p2pEngine.addEventListener('onSegmentLoaded', (details: SegmentLoadDetails) => {
      if (details.downloadSource !== 'http') return

      if (this.options.redundancyUrlManager) {
        this.options.redundancyUrlManager.onSegmentSuccess(details.segmentUrl)
      }
    })

    const redundancyUrlsCount = this.options.redundancyUrlManager
      ? this.options.redundancyUrlManager.countBaseUrls()
      : 0

    this.totalHTTPPeers = 1 + redundancyUrlsCount
    this.statsP2PBytes.peersWithWebSeed = this.totalHTTPPeers

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

    // Track buffer issues
    this.hlsjs.on(Hlsjs.Events.ERROR, (_event, errorData) => {
      if (errorData.type !== Hlsjs.ErrorTypes.MEDIA_ERROR) return

      if (errorData.details === Hlsjs.ErrorDetails.BUFFER_STALLED_ERROR) {
        this.player.trigger('buffer-stalled')
      }
    })
  }

  private runStats () {
    this.connectedPeers = new Set()

    if (this.hlsjs.p2pEngine.getConfig().core.mainStream.isP2PDisabled) {
      this.hlsjs.on(Hlsjs.Events.FRAG_LOADED, (e, data: FragLoadedData) => {
        const bytes = data.frag.stats.loaded

        this.statsHTTPBytes.pendingDownload.push(bytes)
        this.statsHTTPBytes.totalDownload += bytes
      })
    }

    this.hlsjs.p2pEngine.addEventListener('onChunkDownloaded', (bytes: number, method: DownloadSource) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingDownload.push(bytes)
      elem.totalDownload += bytes
    })

    this.hlsjs.p2pEngine.addEventListener('onChunkUploaded', (bytes: number) => {
      this.statsP2PBytes.pendingUpload.push(bytes)
      this.statsP2PBytes.totalUpload += bytes
    })

    this.hlsjs.p2pEngine.addEventListener('onPeerConnect', peer => {
      if (peer.streamType !== 'main') return

      this.connectedPeers.add(peer.peerId)
      this.statsP2PBytes.peersP2POnly = this.connectedPeers.size

      this.statsP2PBytes.peersWithWebSeed = this.totalHTTPPeers + this.statsP2PBytes.peersP2POnly
    })
    this.hlsjs.p2pEngine.addEventListener('onPeerClose', peer => {
      if (peer.streamType !== 'main') return

      this.connectedPeers.delete(peer.peerId)
      this.statsP2PBytes.peersP2POnly = this.connectedPeers.size

      this.statsP2PBytes.peersWithWebSeed = this.totalHTTPPeers + this.statsP2PBytes.peersP2POnly
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
