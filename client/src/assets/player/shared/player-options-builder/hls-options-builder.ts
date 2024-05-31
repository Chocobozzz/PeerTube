import { HybridLoaderSettings } from '@peertube/p2p-media-loader-core'
import { HlsJsEngineSettings } from '@peertube/p2p-media-loader-hlsjs'
import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { getAverageBandwidthInStore } from '../../peertube-player-local-storage'
import { P2PMediaLoader, P2PMediaLoaderPluginOptions, PeerTubePlayerContructorOptions, PeerTubePlayerLoadOptions } from '../../types'
import { getRtcConfig, isSameOrigin } from '../common'
import { RedundancyUrlManager } from '../p2p-media-loader/redundancy-url-manager'
import { segmentUrlBuilderFactory } from '../p2p-media-loader/segment-url-builder'
import { SegmentValidator } from '../p2p-media-loader/segment-validator'

type ConstructorOptions =
  Pick<PeerTubePlayerContructorOptions, 'pluginsManager' | 'serverUrl' | 'authorizationHeader'> &
  Pick<PeerTubePlayerLoadOptions, 'videoPassword' | 'requiresUserAuth' | 'videoFileToken' | 'requiresPassword' |
  'isLive' | 'liveOptions' | 'p2pEnabled' | 'hls'>

export class HLSOptionsBuilder {

  constructor (
    private options: ConstructorOptions,
    private p2pMediaLoaderModule?: any
  ) {

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
    const loader = new this.p2pMediaLoaderModule.Engine(p2pMediaLoaderConfig).createLoaderClass() as P2PMediaLoader

    const p2pMediaLoader: P2PMediaLoaderPluginOptions = {
      requiresUserAuth: this.options.requiresUserAuth,
      videoFileToken: this.options.videoFileToken,

      p2pEnabled: segmentsSha256Url && this.options.p2pEnabled,

      redundancyUrlManager,
      type: 'application/x-mpegURL',
      src: this.options.hls.playlistUrl,
      segmentValidator,
      loader
    }

    const hlsjs = {
      hlsjsConfig: this.getHLSJSOptions(loader),

      levelLabelHandler: (level: { height: number, width: number }) => {
        const resolution = Math.min(level.height || 0, level.width || 0)

        const file = this.options.hls.videoFiles.find(f => f.resolution.id === resolution)
        // We don't have files for live videos
        if (!file) return level.height

        let label = file.resolution.label
        if (file.fps >= 50) label += file.fps

        return label
      }
    }

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
        rtcConfig: getRtcConfig(),

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

  private getHLSJSOptions (loader: P2PMediaLoader) {
    const specificLiveOrVODOptions = this.options.isLive
      ? this.getHLSLiveOptions()
      : this.getHLSVODOptions()

    const base = {
      capLevelToPlayerSize: true,
      autoStartLoad: false,

      loader,

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
      debug: false
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
