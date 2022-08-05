import { isTestOrDevInstance } from '@server/helpers/core-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { VIEW_LIFETIME } from '@server/initializers/constants'
import { sendView } from '@server/lib/activitypub/send/send-view'
import { PeerTubeSocket } from '@server/lib/peertube-socket'
import { getServerActor } from '@server/models/application/application'
import { VideoModel } from '@server/models/video/video'
import { MVideo, MVideoImmutable } from '@server/types/models'
import { buildUUID, sha256 } from '@shared/extra-utils'

const lTags = loggerTagsFactory('views')

export type ViewerScope = 'local' | 'remote'
export type VideoScope = 'local' | 'remote'

type Viewer = {
  expires: number
  id: string
  viewerScope: ViewerScope
  videoScope: VideoScope
  lastFederation?: number
}

export class VideoViewerCounters {

  // expires is new Date().getTime()
  private readonly viewersPerVideo = new Map<number, Viewer[]>()
  private readonly idToViewer = new Map<string, Viewer>()

  private readonly salt = buildUUID()

  private processingViewerCounters = false

  constructor () {
    setInterval(() => this.cleanViewerCounters(), VIEW_LIFETIME.VIEWER_COUNTER)
  }

  // ---------------------------------------------------------------------------

  async addLocalViewer (options: {
    video: MVideoImmutable
    ip: string
  }) {
    const { video, ip } = options

    logger.debug('Adding local viewer to video viewers counter %s.', video.uuid, { ...lTags(video.uuid) })

    const viewerId = this.generateViewerId(ip, video.uuid)
    const viewer = this.idToViewer.get(viewerId)

    if (viewer) {
      viewer.expires = this.buildViewerExpireTime()
      await this.federateViewerIfNeeded(video, viewer)

      return false
    }

    const newViewer = await this.addViewerToVideo({ viewerId, video, viewerScope: 'local' })
    await this.federateViewerIfNeeded(video, newViewer)

    return true
  }

  async addRemoteViewer (options: {
    video: MVideo
    viewerId: string
    viewerExpires: Date
  }) {
    const { video, viewerExpires, viewerId } = options

    logger.debug('Adding remote viewer to video %s.', video.uuid, { ...lTags(video.uuid) })

    await this.addViewerToVideo({ video, viewerExpires, viewerId, viewerScope: 'remote' })

    return true
  }

  // ---------------------------------------------------------------------------

  getTotalViewers (options: {
    viewerScope: ViewerScope
    videoScope: VideoScope
  }) {
    let total = 0

    for (const viewers of this.viewersPerVideo.values()) {
      total += viewers.filter(v => v.viewerScope === options.viewerScope && v.videoScope === options.videoScope).length
    }

    return total
  }

  getViewers (video: MVideo) {
    const viewers = this.viewersPerVideo.get(video.id)
    if (!viewers) return 0

    return viewers.length
  }

  buildViewerExpireTime () {
    return new Date().getTime() + VIEW_LIFETIME.VIEWER_COUNTER
  }

  // ---------------------------------------------------------------------------

  private async addViewerToVideo (options: {
    video: MVideoImmutable
    viewerId: string
    viewerScope: ViewerScope
    viewerExpires?: Date
  }) {
    const { video, viewerExpires, viewerId, viewerScope } = options

    let watchers = this.viewersPerVideo.get(video.id)

    if (!watchers) {
      watchers = []
      this.viewersPerVideo.set(video.id, watchers)
    }

    const expires = viewerExpires
      ? viewerExpires.getTime()
      : this.buildViewerExpireTime()

    const videoScope: VideoScope = video.remote
      ? 'remote'
      : 'local'

    const viewer = { id: viewerId, expires, videoScope, viewerScope }
    watchers.push(viewer)

    this.idToViewer.set(viewerId, viewer)

    await this.notifyClients(video.id, watchers.length)

    return viewer
  }

  private async cleanViewerCounters () {
    if (this.processingViewerCounters) return
    this.processingViewerCounters = true

    if (!isTestOrDevInstance()) logger.info('Cleaning video viewers.', lTags())

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

        await this.notifyClients(videoId, newViewers.length)
      }
    } catch (err) {
      logger.error('Error in video clean viewers scheduler.', { err, ...lTags() })
    }

    this.processingViewerCounters = false
  }

  private async notifyClients (videoId: string | number, viewersLength: number) {
    const video = await VideoModel.loadImmutableAttributes(videoId)
    if (!video) return

    PeerTubeSocket.Instance.sendVideoViewsUpdate(video, viewersLength)

    logger.debug('Video viewers update for %s is %d.', video.url, viewersLength, lTags())
  }

  private generateViewerId (ip: string, videoUUID: string) {
    return sha256(this.salt + '-' + ip + '-' + videoUUID)
  }

  private async federateViewerIfNeeded (video: MVideoImmutable, viewer: Viewer) {
    // Federate the viewer if it's been a "long" time we did not
    const now = new Date().getTime()
    const federationLimit = now - (VIEW_LIFETIME.VIEWER_COUNTER * 0.75)

    if (viewer.lastFederation && viewer.lastFederation > federationLimit) return

    await sendView({ byActor: await getServerActor(), video, type: 'viewer', viewerIdentifier: viewer.id })
    viewer.lastFederation = now
  }
}
