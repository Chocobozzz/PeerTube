// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import * as videojs from 'video.js'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo, VideoJSComponentInterface } from './peertube-videojs-typings'

// videojs-hlsjs-plugin needs videojs in window
window['videojs'] = videojs
require('@streamroot/videojs-hlsjs-plugin')

import { Engine, initVideoJsContribHlsJsPlayer } from 'p2p-media-loader-hlsjs'
import { Events } from 'p2p-media-loader-core'

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {

  private readonly CONSTANTS = {
    INFO_SCHEDULER: 1000 // Don't change this
  }

  private hlsjs: any // Don't type hlsjs to not bundle the module
  private p2pEngine: Engine
  private statsP2PBytes = {
    pendingDownload: [] as number[],
    pendingUpload: [] as number[],
    numPeers: 0,
    totalDownload: 0,
    totalUpload: 0
  }

  private networkInfoInterval: any

  constructor (player: videojs.Player, options: P2PMediaLoaderPluginOptions) {
    super(player, options)

    videojs.Html5Hlsjs.addHook('beforeinitialize', (videojsPlayer: any, hlsjs: any) => {
      this.hlsjs = hlsjs

      this.initialize()
    })

    initVideoJsContribHlsJsPlayer(player)

    player.src({
      type: options.type,
      src: options.src
    })
  }

  dispose () {
    clearInterval(this.networkInfoInterval)
  }

  private initialize () {
    this.p2pEngine = this.player.tech_.options_.hlsjsConfig.loader.getEngine()

    // Avoid using constants to not import hls.hs
    // https://github.com/video-dev/hls.js/blob/master/src/events.js#L37
    this.hlsjs.on('hlsLevelSwitching', (_: any, data: any) => {
      this.trigger('resolutionChange', { auto: this.hlsjs.autoLevelEnabled, resolutionId: data.height })
    })

    this.runStats()
  }

  private runStats () {
    this.p2pEngine.on(Events.PieceBytesDownloaded, (method: string, size: number) => {
      if (method === 'p2p') {
        this.statsP2PBytes.pendingDownload.push(size)
        this.statsP2PBytes.totalDownload += size
      }
    })

    this.p2pEngine.on(Events.PieceBytesUploaded, (method: string, size: number) => {
      if (method === 'p2p') {
        this.statsP2PBytes.pendingUpload.push(size)
        this.statsP2PBytes.totalUpload += size
      }
    })

    this.p2pEngine.on(Events.PeerConnect, () => this.statsP2PBytes.numPeers++)
    this.p2pEngine.on(Events.PeerClose, () => this.statsP2PBytes.numPeers--)

    this.networkInfoInterval = setInterval(() => {
      let downloadSpeed = this.statsP2PBytes.pendingDownload.reduce((a: number, b: number) => a + b, 0)
      let uploadSpeed = this.statsP2PBytes.pendingUpload.reduce((a: number, b: number) => a + b, 0)

      this.statsP2PBytes.pendingDownload = []
      this.statsP2PBytes.pendingUpload = []

      return this.player.trigger('p2pInfo', {
        p2p: {
          downloadSpeed,
          uploadSpeed,
          numPeers: this.statsP2PBytes.numPeers,
          downloaded: this.statsP2PBytes.totalDownload,
          uploaded: this.statsP2PBytes.totalUpload
        }
      } as PlayerNetworkInfo)
    }, this.CONSTANTS.INFO_SCHEDULER)
  }
}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
