import { HybridLoaderSettings } from '@peertube/p2p-media-loader-core'
import { HlsJsEngineSettings } from '@peertube/p2p-media-loader-hlsjs'
import { logger } from '@root-helpers/logger'
import { LiveVideoLatencyMode } from '@shared/models'
import { getAverageBandwidthInStore } from '../../peertube-player-local-storage'
import { P2PMediaLoader, P2PMediaLoaderPluginOptions } from '../../types'
import { PeertubePlayerManagerOptions } from '../../types/manager-options'
import { getRtcConfig, isSameOrigin } from '../common'
import { RedundancyUrlManager } from '../p2p-media-loader/redundancy-url-manager'
import { segmentUrlBuilderFactory } from '../p2p-media-loader/segment-url-builder'
import { segmentValidatorFactory } from '../p2p-media-loader/segment-validator'

export class HLSOptionsBuilder {

  constructor (
    private options: PeertubePlayerManagerOptions,
    private p2pMediaLoaderModule?: any
  ) {

  }

  async getPluginOptions () {
    const commonOptions = this.options.common

    const redundancyUrlManager = new RedundancyUrlManager(this.options.p2pMediaLoader.redundancyBaseUrls)

    const p2pMediaLoaderConfig = await this.options.pluginsManager.runHook(
      'filter:internal.player.p2p-media-loader.options.result',
      this.getP2PMediaLoaderOptions(redundancyUrlManager)
    )
    const loader = new this.p2pMediaLoaderModule.Engine(p2pMediaLoaderConfig).createLoaderClass() as P2PMediaLoader

    const p2pMediaLoader: P2PMediaLoaderPluginOptions = {
      requiresUserAuth: commonOptions.requiresUserAuth,
      videoFileToken: commonOptions.videoFileToken,

      redundancyUrlManager,
      type: 'application/x-mpegURL',
      startTime: commonOptions.startTime,
      src: this.options.p2pMediaLoader.playlistUrl,
      loader
    }

    const hlsjs = {
      levelLabelHandler: (level: { height: number, width: number }) => {
        const resolution = Math.min(level.height || 0, level.width || 0)

        const file = this.options.p2pMediaLoader.videoFiles.find(f => f.resolution.id === resolution)
        // We don't have files for live videos
        if (!file) return level.height

        let label = file.resolution.label
        if (file.fps >= 50) label += file.fps

        return label
      }
    }

    const html5 = {
      hlsjsConfig: this.getHLSJSOptions(loader)
    }

    return { p2pMediaLoader, hlsjs, html5 }
  }

  // ---------------------------------------------------------------------------

  private getP2PMediaLoaderOptions (redundancyUrlManager: RedundancyUrlManager): HlsJsEngineSettings {
    let consumeOnly = false
    if ((navigator as any)?.connection?.type === 'cellular') {
      logger.info('We are on a cellular connection: disabling seeding.')
      consumeOnly = true
    }

    const trackerAnnounce = this.options.p2pMediaLoader.trackerAnnounce
                                                 .filter(t => t.startsWith('ws'))

    const specificLiveOrVODOptions = this.options.common.isLive
      ? this.getP2PMediaLoaderLiveOptions()
      : this.getP2PMediaLoaderVODOptions()

    return {
      loader: {
        trackerAnnounce,
        rtcConfig: getRtcConfig(),

        simultaneousHttpDownloads: 1,
        httpFailedSegmentTimeout: 1000,

        xhrSetup: (xhr, url) => {
          const { requiresUserAuth, requiresPassword } = this.options.common

          if (!(requiresUserAuth || requiresPassword)) return

          if (!isSameOrigin(this.options.common.serverUrl, url)) return

          if (requiresPassword) xhr.setRequestHeader('x-peertube-video-password', this.options.common.videoPassword())

          else xhr.setRequestHeader('Authorization', this.options.common.authorizationHeader())
        },

        segmentValidator: segmentValidatorFactory({
          segmentsSha256Url: this.options.p2pMediaLoader.segmentsSha256Url,
          authorizationHeader: this.options.common.authorizationHeader,
          requiresUserAuth: this.options.common.requiresUserAuth,
          serverUrl: this.options.common.serverUrl,
          requiresPassword: this.options.common.requiresPassword,
          videoPassword: this.options.common.videoPassword
        }),

        segmentUrlBuilder: segmentUrlBuilderFactory(redundancyUrlManager),

        useP2P: this.options.common.p2pEnabled,
        consumeOnly,

        ...specificLiveOrVODOptions
      },
      segments: {
        swarmId: this.options.p2pMediaLoader.playlistUrl,
        forwardSegmentCount: specificLiveOrVODOptions.p2pDownloadMaxPriority ?? 20
      }
    }
  }

  private getP2PMediaLoaderLiveOptions (): Partial<HybridLoaderSettings> {
    const base = {
      requiredSegmentsPriority: 1
    }

    const latencyMode = this.options.common.liveOptions.latencyMode

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
    const specificLiveOrVODOptions = this.options.common.isLive
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
    const latencyMode = this.options.common.liveOptions.latencyMode

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
