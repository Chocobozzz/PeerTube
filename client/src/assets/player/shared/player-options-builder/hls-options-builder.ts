import { HybridLoaderSettings } from '@peertube/p2p-media-loader-core'
import { Engine, HlsJsEngineSettings } from '@peertube/p2p-media-loader-hlsjs'
import { getResolutionAndFPSLabel, getResolutionLabel } from '@peertube/peertube-core-utils'
import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { Level } from 'hls.js'
import { getAverageBandwidthInStore } from '../../peertube-player-local-storage'
import {
  HLSLoaderClass,
  HLSPluginOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubePlayerConstructorOptions,
  PeerTubePlayerLoadOptions
} from '../../types'
import { getRtcConfig, isSameOrigin } from '../common'
import { RedundancyUrlManager } from '../p2p-media-loader/redundancy-url-manager'
import { segmentUrlBuilderFactory } from '../p2p-media-loader/segment-url-builder'
import { SegmentValidator } from '../p2p-media-loader/segment-validator'
import debug from 'debug'

const debugLogger = debug('peertube:player:hls')

type ConstructorOptions =
  Pick<PeerTubePlayerConstructorOptions, 'pluginsManager' | 'serverUrl' | 'authorizationHeader' | 'stunServers'> &
  Pick<PeerTubePlayerLoadOptions, 'videoPassword' | 'requiresUserAuth' | 'videoFileToken' | 'requiresPassword' |
  'isLive' | 'liveOptions' | 'p2pEnabled' | 'hls'>

export class HLSOptionsBuilder {

  constructor (private options: ConstructorOptions) {

  }

  async getPluginOptions () {
    const segmentsSha256Url = this.options.hls.segmentsSha256Url

    if (!segmentsSha256Url) {
      logger.info('No segmentsSha256Url found. Disabling P2P & redundancy.')
    }

    const redundancyUrlManager = segmentsSha256Url
      ? new RedundancyUrlManager(this.options.hls.redundancyBaseUrls)
      : null

    const segmentValidator = segmentsSha256Url
      ? new SegmentValidator({
        segmentsSha256Url,
        authorizationHeader: this.options.authorizationHeader,
        requiresUserAuth: this.options.requiresUserAuth,
        serverUrl: this.options.serverUrl,
        requiresPassword: this.options.requiresPassword,
        videoPassword: this.options.videoPassword
      })
      : null

    const p2pMediaLoaderConfig = await this.options.pluginsManager.runHook(
      'filter:internal.player.p2p-media-loader.options.result',
      this.getP2PMediaLoaderOptions({ redundancyUrlManager, segmentValidator })
    )
    const loaderBuilder = () => new Engine(p2pMediaLoaderConfig).createLoaderClass() as unknown as HLSLoaderClass

    const p2pMediaLoader: P2PMediaLoaderPluginOptions = {
      requiresUserAuth: this.options.requiresUserAuth,
      videoFileToken: this.options.videoFileToken,

      p2pEnabled: segmentsSha256Url && this.options.p2pEnabled,

      redundancyUrlManager,
      type: 'application/x-mpegURL',
      src: this.options.hls.playlistUrl,
      segmentValidator
    }

    const hlsjs = {
      hlsjsConfig: this.getHLSJSOptions(loaderBuilder),

      levelLabelHandler: (level: Level, player: videojs.VideoJsPlayer) => {
        const resolution = Math.min(level.height || 0, level.width || 0)
        const file = this.options.hls.videoFiles.find(f => f.resolution.id === resolution)

        const resolutionLabel = getResolutionLabel({
          resolution,
          height: file?.height ?? level.height,
          width: file?.width ?? level.width
        })

        return player.localize(getResolutionAndFPSLabel(resolutionLabel, file?.fps ?? level.frameRate))
      }
    }

    debugLogger('Creating HLS player options', { hlsjs, p2pMediaLoader, loaderOptions: p2pMediaLoaderConfig })

    return { p2pMediaLoader, hlsjs }
  }

  // ---------------------------------------------------------------------------

  private getP2PMediaLoaderOptions (options: {
    redundancyUrlManager: RedundancyUrlManager | null
    segmentValidator: SegmentValidator | null
  }): HlsJsEngineSettings {
    const { redundancyUrlManager, segmentValidator } = options

    let consumeOnly = false
    if (
      (navigator as any)?.connection?.type === 'cellular' ||
      peertubeLocalStorage.getItem('peertube-videojs-p2p-consume-only') === 'true' // Use for E2E testing
    ) {
      logger.info('We are on a cellular connection: disabling seeding.')
      consumeOnly = true
    }

    const trackerAnnounce = this.options.hls.trackerAnnounce
      .filter(t => t.startsWith('ws'))

    const specificLiveOrVODOptions = this.options.isLive
      ? this.getP2PMediaLoaderLiveOptions()
      : this.getP2PMediaLoaderVODOptions()

    return {
      loader: {
        trackerAnnounce,
        rtcConfig: getRtcConfig(this.options.stunServers),

        simultaneousHttpDownloads: 1,
        httpFailedSegmentTimeout: 1000,

        xhrSetup: (xhr, url) => {
          const { requiresUserAuth, requiresPassword } = this.options

          if (!(requiresUserAuth || requiresPassword)) return

          if (!isSameOrigin(this.options.serverUrl, url)) return

          if (requiresPassword) xhr.setRequestHeader('x-peertube-video-password', this.options.videoPassword())
          else xhr.setRequestHeader('Authorization', this.options.authorizationHeader())
        },

        segmentValidator: segmentValidator
          ? segmentValidator.validate.bind(segmentValidator)
          : null,

        segmentUrlBuilder: segmentUrlBuilderFactory(redundancyUrlManager),

        useP2P: this.options.p2pEnabled,
        consumeOnly,

        ...specificLiveOrVODOptions
      },
      segments: {
        swarmId: this.options.hls.playlistUrl,
        forwardSegmentCount: specificLiveOrVODOptions.p2pDownloadMaxPriority ?? 20
      }
    }
  }

  private getP2PMediaLoaderLiveOptions (): Partial<HybridLoaderSettings> {
    const base = {
      requiredSegmentsPriority: 1
    }

    const latencyMode = this.options.liveOptions.latencyMode

    switch (latencyMode) {
      case LiveVideoLatencyMode.SMALL_LATENCY:
        return {
          ...base,

          useP2P: false,
          requiredSegmentsPriority: 10
        }

      case LiveVideoLatencyMode.HIGH_LATENCY:
        return base

      default:
        return base
    }
  }

  private getP2PMediaLoaderVODOptions (): Partial<HybridLoaderSettings> {
    return {
      requiredSegmentsPriority: 3,
      skipSegmentBuilderPriority: 1,

      cachedSegmentExpiration: 86400000,
      cachedSegmentsCount: 100,

      httpDownloadMaxPriority: 9,
      httpDownloadProbability: 0.06,
      httpDownloadProbabilitySkipIfNoPeers: true,

      p2pDownloadMaxPriority: 50
    }
  }

  // ---------------------------------------------------------------------------

  private getHLSJSOptions (loaderBuilder: () => HLSLoaderClass): HLSPluginOptions {
    const specificLiveOrVODOptions = this.options.isLive
      ? this.getHLSLiveOptions()
      : this.getHLSVODOptions()

    const base = {
      capLevelToPlayerSize: true,
      autoStartLoad: false,

      loaderBuilder,

      ...specificLiveOrVODOptions
    }

    const averageBandwidth = getAverageBandwidthInStore()
    if (!averageBandwidth) return base

    return {
      ...base,

      abrEwmaDefaultEstimate: averageBandwidth * 8, // We want bit/s
      backBufferLength: 90,
      startLevel: -1,
      testBandwidth: false,
      debug: false,
      enableWorker: false
    }
  }

  private getHLSLiveOptions () {
    const latencyMode = this.options.liveOptions.latencyMode

    switch (latencyMode) {
      case LiveVideoLatencyMode.SMALL_LATENCY:
        return {
          liveSyncDurationCount: 2
        }

      case LiveVideoLatencyMode.HIGH_LATENCY:
        return {
          liveSyncDurationCount: 10
        }

      default:
        return {
          liveSyncDurationCount: 5
        }
    }
  }

  private getHLSVODOptions () {
    return {
      liveSyncDurationCount: 5
    }
  }
}
