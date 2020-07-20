import videojs from 'video.js'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo } from '../peertube-videojs-typings'
import { Engine, initHlsJsPlayer, initVideoJsContribHlsJsPlayer } from 'p2p-media-loader-hlsjs'
import { Events, Segment } from 'p2p-media-loader-core'
import { timeToInt } from '../utils'
import { registerConfigPlugin, registerSourceHandler } from './hls-plugin'
import * as Hlsjs from 'hls.js/dist/hls.light.js'

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
    pendingUpload: [] as number[],
    totalDownload: 0,
    totalUpload: 0
  }
  private startTime: number

  private networkInfoInterval: any

  constructor (player: videojs.Player, options?: P2PMediaLoaderPluginOptions) {
    super(player)

    this.options = options

    // FIXME: typings https://github.com/Microsoft/TypeScript/issues/14080
    if (!(videojs as any).Html5Hlsjs) {
      console.warn('HLS.js does not seem to be supported. Try to fallback to built in HLS.')

      if (!player.canPlayType('application/vnd.apple.mpegurl')) {
        const message = 'Cannot fallback to built-in HLS'
        console.warn(message)

        player.ready(() => player.trigger('error', new Error(message)))
        return
      }
    } else {
      // FIXME: typings https://github.com/Microsoft/TypeScript/issues/14080
      (videojs as any).Html5Hlsjs.addHook('beforeinitialize', (videojsPlayer: any, hlsjs: any) => {
        this.hlsjs = hlsjs
      })

      initVideoJsContribHlsJsPlayer(player)
    }

    this.startTime = timeToInt(options.startTime)

    player.src({
      type: options.type,
      src: options.src
    })

    player.ready(() => {
      this.initializeCore()

      if ((videojs as any).Html5Hlsjs) {
        this.initializePlugin()
      }
    })
  }

  dispose () {
    if (this.hlsjs) this.hlsjs.destroy()
    if (this.p2pEngine) this.p2pEngine.destroy()

    clearInterval(this.networkInfoInterval)
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

    // FIXME: typings
    const options = this.player.tech(true).options_ as any
    this.p2pEngine = options.hlsjsConfig.loader.getEngine()

    this.hlsjs.on(Hlsjs.Events.LEVEL_SWITCHING, (_: any, data: any) => {
      this.trigger('resolutionChange', { auto: this.hlsjs.autoLevelEnabled, resolutionId: data.height })
    })

    this.p2pEngine.on(Events.SegmentError, (segment: Segment, err) => {
      console.error('Segment error.', segment, err)

      this.options.redundancyUrlManager.removeBySegmentUrl(segment.requestUrl)
    })

    this.statsP2PBytes.numPeers = 1 + this.options.redundancyUrlManager.countBaseUrls()

    this.runStats()
  }

  private runStats () {
    this.p2pEngine.on(Events.PieceBytesDownloaded, (method: string, size: number) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingDownload.push(size)
      elem.totalDownload += size
    })

    this.p2pEngine.on(Events.PieceBytesUploaded, (method: string, size: number) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingUpload.push(size)
      elem.totalUpload += size
    })

    this.p2pEngine.on(Events.PeerConnect, () => this.statsP2PBytes.numPeers++)
    this.p2pEngine.on(Events.PeerClose, () => this.statsP2PBytes.numPeers--)

    this.networkInfoInterval = setInterval(() => {
      const p2pDownloadSpeed = this.arraySum(this.statsP2PBytes.pendingDownload)
      const p2pUploadSpeed = this.arraySum(this.statsP2PBytes.pendingUpload)

      const httpDownloadSpeed = this.arraySum(this.statsHTTPBytes.pendingDownload)
      const httpUploadSpeed = this.arraySum(this.statsHTTPBytes.pendingUpload)

      this.statsP2PBytes.pendingDownload = []
      this.statsP2PBytes.pendingUpload = []
      this.statsHTTPBytes.pendingDownload = []
      this.statsHTTPBytes.pendingUpload = []

      return this.player.trigger('p2pInfo', {
        http: {
          downloadSpeed: httpDownloadSpeed,
          uploadSpeed: httpUploadSpeed,
          downloaded: this.statsHTTPBytes.totalDownload,
          uploaded: this.statsHTTPBytes.totalUpload
        },
        p2p: {
          downloadSpeed: p2pDownloadSpeed,
          uploadSpeed: p2pUploadSpeed,
          numPeers: this.statsP2PBytes.numPeers,
          downloaded: this.statsP2PBytes.totalDownload,
          uploaded: this.statsP2PBytes.totalUpload
        }
      } as PlayerNetworkInfo)
    }, this.CONSTANTS.INFO_SCHEDULER)
  }

  private arraySum (data: number[]) {
    return data.reduce((a: number, b: number) => a + b, 0)
  }
}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
