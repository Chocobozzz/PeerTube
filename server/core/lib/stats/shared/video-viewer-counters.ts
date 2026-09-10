import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { createLogger } from '@server/helpers/logger.js'
import { VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sendView } from '@server/lib/activitypub/send/send-view.js'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
import { PeerTubeSocket } from '@server/lib/peertube-socket.js'
import { Redis } from '@server/lib/redis/index.js'
import { getServerActor } from '@server/models/application/application.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'

const logger = createLogger('views')

export type ViewerScope = 'local' | 'remote'
export type VideoScope = 'local' | 'remote'

type Viewer = {
  expires: number
  id: string
  viewerScope: ViewerScope
  videoScope: VideoScope
  viewerCount: number
  lastFederation?: number
}

/**
 * Viewer counters live in Redis so that every PeerTube process sees the same "currently watching" count
 *
 * `getTotalViewersOf()` is called synchronously by the video formatter for every video of a list response so it cannot await Redis
 * So each process keeps a local snapshot of the aggregated counts: fully recomputed from Redis by the periodic loop
 * And bumped for new viewers this process registers so a freshly started process does not report 0 until the first loop pass
 */
export class VideoViewerCounters {
  // Aggregated snapshots for synchronous reads
  // Redis is the source of truth
  private readonly totalViewersPerVideo = new Map<number, number>()
  private readonly totalViewersPerScope = new Map<string, number>()

  private processingViewerCounters = false

  // Expiring viewers, notifying clients and federating counts must be done by a single process
  private readonly enableDatabaseFlush: boolean

  constructor (options: { enableDatabaseFlush?: boolean } = {}) {
    this.enableDatabaseFlush = options.enableDatabaseFlush !== false

    setInterval(() => this.updateVideoViewersCount(), VIEW_LIFETIME.VIEWER_COUNTER)
  }

  // ---------------------------------------------------------------------------

  async addLocalViewer (options: {
    video: MVideoImmutable
    sessionId: string
  }) {
    const { video, sessionId } = options

    logger.debug('Adding local viewer to video viewers counter %s.', video.uuid)

    const viewerId = sessionId + '-' + video.uuid

    const { isNew, mustFederate } = await this.addViewerToVideo({
      viewerId,
      video,
      viewerScope: 'local',
      viewerCount: 1,
      // Federate the viewer of a remote video if it's been a "long" time we did not
      federateIfNeeded: video.remote === true
    })

    if (mustFederate) {
      await sendView({ byActor: await getServerActor(), video, viewersCount: 1, viewerIdentifier: viewerId })
    }

    return isNew
  }

  async addRemoteViewerOnLocalVideo (options: {
    video: MVideo
    viewerId: string
    viewerExpires: Date
  }) {
    const { video, viewerExpires, viewerId } = options

    logger.debug('Adding remote viewer to local video %s.', video.uuid, { viewerId, viewerExpires })

    const { isNew } = await this.addViewerToVideo({ video, viewerExpires, viewerId, viewerScope: 'remote', viewerCount: 1 })

    return isNew
  }

  async addRemoteViewerOnRemoteVideo (options: {
    video: MVideo
    viewerId: string
    viewerExpires: Date
    viewerResultCounter?: number
  }) {
    const { video, viewerExpires, viewerId, viewerResultCounter } = options

    logger.debug('Adding remote viewer to remote video %s.', video.uuid, { viewerId, viewerResultCounter, viewerExpires })

    await this.addViewerToVideo({
      video,
      viewerExpires,
      viewerId,
      viewerScope: 'remote',
      // The origin server sends a summary of all viewers, so we can replace our local copy
      replaceCurrentViewers: exists(viewerResultCounter),
      viewerCount: viewerResultCounter ?? 1
    })

    return true
  }

  // ---------------------------------------------------------------------------

  getTotalViewers (options: {
    viewerScope: ViewerScope
    videoScope: VideoScope
  }) {
    return this.totalViewersPerScope.get(this.buildScopeKey(options.viewerScope, options.videoScope)) || 0
  }

  getTotalViewersOf (video: MVideoImmutable) {
    return this.totalViewersPerVideo.get(video.id) || 0
  }

  buildViewerExpireTime () {
    return new Date().getTime() + VIEW_LIFETIME.VIEWER_COUNTER
  }

  // ---------------------------------------------------------------------------

  /**
   * Adds the viewer, or pushes back the expiration of the one already known
   * Return the result to know if this process is the one that has to federate it
   */
  private async addViewerToVideo (options: {
    video: MVideoImmutable
    viewerId: string
    viewerScope: ViewerScope
    viewerCount: number
    replaceCurrentViewers?: boolean
    viewerExpires?: Date
    federateIfNeeded?: boolean
  }) {
    const { video, viewerExpires, viewerId, viewerScope, viewerCount, replaceCurrentViewers, federateIfNeeded } = options

    const now = new Date().getTime()

    const result = await Redis.Instance.addVideoViewerCounter({
      videoId: video.id,
      viewerId,

      expires: viewerExpires
        ? viewerExpires.getTime()
        : this.buildViewerExpireTime(),

      viewerScope,
      videoScope: video.remote ? 'remote' : 'local',
      viewerCount,
      now,

      federateBefore: federateIfNeeded
        ? now - (VIEW_LIFETIME.VIEWER_COUNTER * 0.75)
        : 0,

      replaceCurrentViewers
    })

    this.setVideoSnapshot(video.id, result.totalViewers)

    // A viewer refreshing its expiration does not change the count, so there is nothing to send
    if (result.isNew) this.notifyClients(video)

    return result
  }

  private async updateVideoViewersCount () {
    if (this.processingViewerCounters) return
    this.processingViewerCounters = true

    if (!isTestOrDevInstance()) {
      logger.debug('Updating video viewer counters.')
    }

    try {
      const staleVideoIds = new Set(this.totalViewersPerVideo.keys())

      const videoIds = await Redis.Instance.listVideoIdsWithViewers()

      const totalViewersPerScope = new Map<string, number>()

      for (const videoId of videoIds) {
        staleVideoIds.delete(videoId)

        try {
          await this.updateVideoViewerCount(videoId, totalViewersPerScope)
        } catch (err) {
          logger.error('Cannot update the viewer counter of video %d.', videoId, { err })
        }
      }

      for (const videoId of staleVideoIds) {
        this.totalViewersPerVideo.delete(videoId)
      }

      this.replaceScopeSnapshot(totalViewersPerScope)
    } catch (err) {
      logger.error('Error in video viewer counters scheduler.', { err })
    }

    this.processingViewerCounters = false
  }

  private async updateVideoViewerCount (videoId: number, totalViewersPerScope: Map<string, number>) {
    const expiredIfBefore = new Date().getTime()

    const viewers = await Redis.Instance.listVideoViewerCounters<Viewer>(videoId)

    const expiredIds: string[] = []
    let total = 0

    for (const [ viewerId, viewer ] of Object.entries(viewers)) {
      // Not expired
      if (viewer.expires > expiredIfBefore) {
        total += viewer.viewerCount

        const scopeKey = this.buildScopeKey(viewer.viewerScope, viewer.videoScope)
        totalViewersPerScope.set(scopeKey, (totalViewersPerScope.get(scopeKey) || 0) + viewer.viewerCount)
      } else {
        expiredIds.push(viewerId)
      }
    }

    // Only the scheduler owner mutates Redis, but every process refreshes its own read snapshot
    if (this.enableDatabaseFlush) {
      // Drop the key when the hash is empty, so the video id does not leak in the set
      if (total === 0) {
        await Redis.Instance.deleteAllVideoViewerCounters(videoId)
      } else if (expiredIds.length !== 0) {
        await Redis.Instance.deleteVideoViewerCounters(videoId, expiredIds, total)
      }
    }

    this.setVideoSnapshot(videoId, total)

    // Notify clients and federate the total viewers if needed for the scheduler owner
    if (!this.enableDatabaseFlush) return

    const video = await VideoModel.loadWithBlacklist(videoId)
    if (!video) return

    this.notifyClients(video)

    // Let total viewers expire on remote instances if there are no more viewers
    if (total !== 0 && video.isLocal() && canVideoBeFederated(video)) {
      await this.federateTotalViewers(video)
    }
  }

  private setVideoSnapshot (videoId: number, total: number) {
    if (total === 0) this.totalViewersPerVideo.delete(videoId)
    else this.totalViewersPerVideo.set(videoId, total)
  }

  private replaceScopeSnapshot (scopeTotals: Map<string, number>) {
    this.totalViewersPerScope.clear()

    for (const [ key, value ] of scopeTotals) {
      this.totalViewersPerScope.set(key, value)
    }
  }

  private buildScopeKey (viewerScope: ViewerScope, videoScope: VideoScope) {
    return viewerScope + '-' + videoScope
  }

  private notifyClients (video: MVideoImmutable) {
    const totalViewers = this.getTotalViewersOf(video)
    PeerTubeSocket.Instance.sendVideoViewsUpdate(video, totalViewers)

    logger.debug('Video viewers update for %s is %d.', video.url, totalViewers)
  }

  private async federateTotalViewers (video: MVideoImmutable) {
    await sendView({
      byActor: await getServerActor(),
      video,
      viewersCount: this.getTotalViewersOf(video),
      viewerIdentifier: video.uuid
    })
  }
}
