import { Counter, Meter } from '@opentelemetry/api-metrics'
import { MVideoImmutable } from '@server/types/models'
import { PlaybackMetricCreate } from '@shared/models'

export class PlaybackMetrics {
  private errorsCounter: Counter
  private resolutionChangesCounter: Counter

  private downloadedBytesP2PCounter: Counter
  private uploadedBytesP2PCounter: Counter

  private downloadedBytesHTTPCounter: Counter

  constructor (private readonly meter: Meter) {

  }

  buildCounters () {
    this.errorsCounter = this.meter.createCounter('peertube_playback_errors_count', {
      description: 'Errors collected from PeerTube player.'
    })

    this.resolutionChangesCounter = this.meter.createCounter('peertube_playback_resolution_changes_count', {
      description: 'Resolution changes collected from PeerTube player.'
    })

    this.downloadedBytesHTTPCounter = this.meter.createCounter('peertube_playback_http_downloaded_bytes', {
      description: 'Downloaded bytes with HTTP by PeerTube player.'
    })
    this.downloadedBytesP2PCounter = this.meter.createCounter('peertube_playback_p2p_downloaded_bytes', {
      description: 'Downloaded bytes with P2P by PeerTube player.'
    })

    this.uploadedBytesP2PCounter = this.meter.createCounter('peertube_playback_p2p_uploaded_bytes', {
      description: 'Uploaded bytes with P2P by PeerTube player.'
    })
  }

  observe (video: MVideoImmutable, metrics: PlaybackMetricCreate) {
    const attributes = {
      videoOrigin: video.remote
        ? 'remote'
        : 'local',

      playerMode: metrics.playerMode,

      resolution: metrics.resolution + '',
      fps: metrics.fps + '',

      videoUUID: video.uuid
    }

    this.errorsCounter.add(metrics.errors, attributes)
    this.resolutionChangesCounter.add(metrics.resolutionChanges, attributes)

    this.downloadedBytesHTTPCounter.add(metrics.downloadedBytesHTTP, attributes)
    this.downloadedBytesP2PCounter.add(metrics.downloadedBytesP2P, attributes)

    this.uploadedBytesP2PCounter.add(metrics.uploadedBytesP2P, attributes)
  }
}
