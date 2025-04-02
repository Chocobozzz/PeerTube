import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sendView } from '@server/lib/activitypub/send/send-view.js'
import { PeerTubeSocket } from '@server/lib/peertube-socket.js'
import { getServerActor } from '@server/models/application/application.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'

const lTags = loggerTagsFactory('views')

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

export class VideoViewerCounters {

  // expires is new Date().getTime()
  private readonly viewersPerVideo = new Map<number, Viewer[]>()
  private readonly idToViewer = new Map<string, Viewer>()

  private processingViewerCounters = false

  constructor () {
    setInterval(() => this.updateVideoViewersCount(), VIEW_LIFETIME.VIEWER_COUNTER)
  }

  // ---------------------------------------------------------------------------

  async addLocalViewer (options: {
    video: MVideoImmutable
    sessionId: string
  }) {
    const { video, sessionId } = options

    logger.debug('Adding local viewer to video viewers counter %s.', video.uuid, { ...lTags(video.uuid) })

    const viewerId = sessionId + '-' + video.uuid
    const viewer = this.idToViewer.get(viewerId)

    if (viewer) {
      viewer.expires = this.buildViewerExpireTime()
      await this.federateViewerIfNeeded(video, viewer)

      return false
    }

    const newViewer = this.addViewerToVideo({ viewerId, video, viewerScope: 'local', viewerCount: 1 })
    await this.federateViewerIfNeeded(video, newViewer)

    return true
  }

  addRemoteViewerOnLocalVideo (options: {
    video: MVideo
    viewerId: string
    viewerExpires: Date
  }) {
    const { video, viewerExpires, viewerId } = options

    logger.debug('Adding remote viewer to local video %s.', video.uuid, { viewerId, viewerExpires, ...lTags(video.uuid) })

    const viewer = this.idToViewer.get(viewerId)
    if (viewer) {
      viewer.expires = viewerExpires.getTime()

      return false
    }

    this.addViewerToVideo({ video, viewerExpires, viewerId, viewerScope: 'remote', viewerCount: 1 })

    return true
  }

  addRemoteViewerOnRemoteVideo (options: {
    video: MVideo
    viewerId: string
    viewerExpires: Date
    viewerResultCounter?: number
  }) {
    const { video, viewerExpires, viewerId, viewerResultCounter } = options

    logger.debug(
      'Adding remote viewer to remote video %s.', video.uuid,
      { viewerId, viewerResultCounter, viewerExpires, ...lTags(video.uuid) }
    )

    this.addViewerToVideo({
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
    let total = 0

    for (const viewers of this.viewersPerVideo.values()) {
      total += viewers.filter(v => v.viewerScope === options.viewerScope && v.videoScope === options.videoScope)
        .reduce((p, c) => p + c.viewerCount, 0)
    }

    return total
  }

  getTotalViewersOf (video: MVideoImmutable) {
    const viewers = this.viewersPerVideo.get(video.id)

    return viewers?.reduce((p, c) => p + c.viewerCount, 0) || 0
  }

  buildViewerExpireTime () {
    return new Date().getTime() + VIEW_LIFETIME.VIEWER_COUNTER
  }

  // ---------------------------------------------------------------------------

  private addViewerToVideo (options: {
    video: MVideoImmutable
    viewerId: string
    viewerScope: ViewerScope
    viewerCount: number
    replaceCurrentViewers?: boolean
    viewerExpires?: Date
  }) {
    const { video, viewerExpires, viewerId, viewerScope, viewerCount, replaceCurrentViewers } = options

    let watchers = this.viewersPerVideo.get(video.id)

    if (!watchers || replaceCurrentViewers) {
      watchers = []
      this.viewersPerVideo.set(video.id, watchers)
    }

    const expires = viewerExpires
      ? viewerExpires.getTime()
      : this.buildViewerExpireTime()

    const videoScope: VideoScope = video.remote
      ? 'remote'
      : 'local'

    const viewer = { id: viewerId, expires, videoScope, viewerScope, viewerCount }
    watchers.push(viewer)

    this.idToViewer.set(viewerId, viewer)

    this.notifyClients(video)

    return viewer
  }

  private async updateVideoViewersCount () {
    if (this.processingViewerCounters) return
    this.processingViewerCounters = true

    if (!isTestOrDevInstance()) {
      logger.debug('Updating video viewer counters.', lTags())
    }

    try {
      for (const videoId of this.viewersPerVideo.keys()) {
        const notBefore = new Date().getTime()

        const viewers = this.viewersPerVideo.get(videoId)

        // Only keep not expired viewers
        const newViewers: Viewer[] = []

        // Filter new viewers
        for (const viewer of viewers) {
          if (viewer.expires > notBefore) {
            newViewers.push(viewer)
          } else {
            this.idToViewer.delete(viewer.id)
          }
        }

        if (newViewers.length === 0) this.viewersPerVideo.delete(videoId)
        else this.viewersPerVideo.set(videoId, newViewers)

        const video = await VideoModel.loadImmutableAttributes(videoId)

        if (video) {
          this.notifyClients(video)

          // Let total viewers expire on remote instances if there are no more viewers
          if (video.remote === false && newViewers.length !== 0) {
            await this.federateTotalViewers(video)
          }
        }
      }
    } catch (err) {
      logger.error('Error in video clean viewers scheduler.', { err, ...lTags() })
    }

    this.processingViewerCounters = false
  }

  private notifyClients (video: MVideoImmutable) {
    const totalViewers = this.getTotalViewersOf(video)
    PeerTubeSocket.Instance.sendVideoViewsUpdate(video, totalViewers)

    logger.debug('Video viewers update for %s is %d.', video.url, totalViewers, lTags())
  }

  private async federateViewerIfNeeded (video: MVideoImmutable, viewer: Viewer) {
    // Federate the viewer if it's been a "long" time we did not
    const now = new Date().getTime()
    const federationLimit = now - (VIEW_LIFETIME.VIEWER_COUNTER * 0.75)

    if (viewer.lastFederation && viewer.lastFederation > federationLimit) return
    if (video.remote === false) return

    await sendView({
      byActor: await getServerActor(),
      video,
      viewersCount: 1,
      viewerIdentifier: viewer.id
    })

    viewer.lastFederation = now
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
