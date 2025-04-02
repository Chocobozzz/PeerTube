import { getResolutionAndFPSLabel, getResolutionLabel } from '@peertube/peertube-core-utils'
import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import debug from 'debug'
import { Level } from 'hls.js'
import type { CoreConfig, StreamConfig } from 'p2p-media-loader-core'
import { getAverageBandwidthInStore } from '../../peertube-player-local-storage'
import {
  HLSPluginOptions,
  P2PMediaLoaderPluginOptions,
  PeerTubePlayerConstructorOptions,
  PeerTubePlayerLoadOptions
} from '../../types'
import { getRtcConfig, isSameOrigin } from '../common'
import { RedundancyUrlManager } from '../p2p-media-loader/redundancy-url-manager'
import { SegmentValidator } from '../p2p-media-loader/segment-validator'

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
      hlsjsConfig: this.getHLSJSOptions(p2pMediaLoaderConfig),

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
  }) {
    const { redundancyUrlManager, segmentValidator } = options

    let isP2PUploadDisabled = false
    if (
      (navigator as any)?.connection?.type === 'cellular' ||
      peertubeLocalStorage.getItem('peertube-videojs-p2p-consume-only') === 'true' // Use for E2E testing
    ) {
      logger.info('We are on a cellular connection: disabling seeding.')
      isP2PUploadDisabled = true
    }

    const announceTrackers = this.options.hls.trackerAnnounce
      .filter(t => t.startsWith('ws'))

    const specificLiveOrVODOptions = this.options.isLive
      ? this.getP2PMediaLoaderLiveOptions()
      : this.getP2PMediaLoaderVODOptions()

    // TODO: remove validateHTTPSegment typing when p2p-media-loader-core is updated
    const loaderOptions: Partial<StreamConfig> & { validateHTTPSegment: any } = {
      announceTrackers,
      rtcConfig: getRtcConfig(this.options.stunServers),

      httpRequestSetup: (segmentUrlArg, segmentByteRange, requestAbortSignal, requestByteRange) => {
        const { requiresUserAuth, requiresPassword } = this.options

        const segmentUrl = redundancyUrlManager
          ? redundancyUrlManager.buildUrl(segmentUrlArg)
          : segmentUrlArg

        const headers = new Headers()

        if (requestByteRange) {
          headers.set('Range', `bytes=${requestByteRange.start}-${requestByteRange.end ?? ''}`)
        }

        if (isSameOrigin(this.options.serverUrl, segmentUrl)) {
          if (requiresPassword) {
            headers.set('x-peertube-video-password', this.options.videoPassword())
          } else if (requiresUserAuth) {
            headers.set('Authorization', this.options.authorizationHeader())
          }
        }

        return Promise.resolve(
          new Request(segmentUrl, {
            headers,
            signal: requestAbortSignal
          })
        )
      },

      validateP2PSegment: segmentValidator
        ? segmentValidator.validate.bind(segmentValidator)
        : null,

      validateHTTPSegment: segmentValidator
        ? segmentValidator.validate.bind(segmentValidator)
        : null,

      isP2PDisabled: !this.options.p2pEnabled,
      isP2PUploadDisabled,

      swarmId: this.options.hls.playlistUrl,

      ...specificLiveOrVODOptions
    }

    return { loader: loaderOptions }
  }

  private getP2PMediaLoaderLiveOptions (): Partial<CoreConfig> {
    const base = {
      highDemandTimeWindow: 4
    }

    const latencyMode = this.options.liveOptions.latencyMode

    switch (latencyMode) {
      case LiveVideoLatencyMode.SMALL_LATENCY:
        return {
          ...base,

          isP2PDisabled: true
        }

      case LiveVideoLatencyMode.HIGH_LATENCY:
        return base

      default:
        return base
    }
  }

  private getP2PMediaLoaderVODOptions (): Partial<CoreConfig> {
    return {
      highDemandTimeWindow: 15,

      segmentMemoryStorageLimit: 1024
    }
  }

  // ---------------------------------------------------------------------------

  private getHLSJSOptions (p2pMediaLoaderConfig: { loader: CoreConfig }): HLSPluginOptions {
    const specificLiveOrVODOptions = this.options.isLive
      ? this.getHLSLiveOptions()
      : this.getHLSVODOptions()

    const base: HLSPluginOptions = {
      capLevelToPlayerSize: true,
      autoStartLoad: false,

      p2pMediaLoaderOptions: p2pMediaLoaderConfig.loader,

      // p2p-media-loader uses hls.js loader to fetch m3u8 playlists
      xhrSetup: (xhr, url) => {
        const { requiresUserAuth, requiresPassword } = this.options

        if (isSameOrigin(this.options.serverUrl, url)) {
          if (requiresPassword) {
            xhr.setRequestHeader('x-peertube-video-password', this.options.videoPassword())
          } else if (requiresUserAuth) {
            xhr.setRequestHeader('Authorization', this.options.authorizationHeader())
          }
        }
      },

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
