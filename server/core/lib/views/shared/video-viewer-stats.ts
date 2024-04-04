import { VideoViewEvent } from '@peertube/peertube-models'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { GeoIP } from '@server/helpers/geo-ip.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { MAX_LOCAL_VIEWER_WATCH_SECTIONS, VIEWER_SYNC_REDIS, VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { sendCreateWatchAction } from '@server/lib/activitypub/send/index.js'
import { getLocalVideoViewerActivityPubUrl } from '@server/lib/activitypub/url.js'
import { Redis } from '@server/lib/redis.js'
import { VideoModel } from '@server/models/video/video.js'
import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section.js'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'

const lTags = loggerTagsFactory('views')

type LocalViewerStats = {
  firstUpdated: number // Date.getTime()
  lastUpdated: number // Date.getTime()

  watchSections: {
    start: number
    end: number
  }[]

  watchTime: number

  country: string
  subdivisionName: string

  videoId: number
}

export class VideoViewerStats {
  private processingViewersStats = false
  private processingRedisWrites = false

  private readonly viewerCache = new Map<string, LocalViewerStats>()
  private readonly redisPendingWrites = new Map<string, { sessionId: string, videoId: number, stats: LocalViewerStats }>()

  constructor () {
    setInterval(() => this.processViewerStats(), VIEW_LIFETIME.VIEWER_STATS)
    setInterval(() => this.syncRedisWrites(), VIEWER_SYNC_REDIS)
  }

  // ---------------------------------------------------------------------------

  async addLocalViewer (options: {
    video: MVideoImmutable
    currentTime: number
    ip: string
    sessionId: string
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime, sessionId } = options

    logger.debug(
      'Adding local viewer to video stats %s.', video.uuid,
      { currentTime, viewEvent, sessionId, ...lTags(video.uuid) }
    )

    const nowMs = new Date().getTime()

    let stats: LocalViewerStats = await this.getLocalVideoViewer({ sessionId, videoId: video.id })

    if (stats && stats.watchSections.length >= MAX_LOCAL_VIEWER_WATCH_SECTIONS) {
      logger.warn('Too much watch section to store for a viewer, skipping this one', { currentTime, viewEvent, ...lTags(video.uuid) })
      return
    }

    if (!stats) {
      const { country, subdivisionName } = await GeoIP.Instance.safeIPISOLookup(ip)

      stats = {
        firstUpdated: nowMs,
        lastUpdated: nowMs,

        watchSections: [],

        watchTime: 0,

        country,
        subdivisionName,

        videoId: video.id
      }
    }

    stats.lastUpdated = nowMs

    if (viewEvent === 'seek' || stats.watchSections.length === 0) {
      stats.watchSections.push({
        start: currentTime,
        end: currentTime
      })
    } else {
      const lastSection = stats.watchSections[stats.watchSections.length - 1]

      if (lastSection.start > currentTime) {
        logger.debug('Invalid end watch section %d. Last start record was at %d. Starting a new section.', currentTime, lastSection.start)

        stats.watchSections.push({
          start: currentTime,
          end: currentTime
        })
      } else {
        lastSection.end = currentTime
      }
    }

    stats.watchTime = this.buildWatchTimeFromSections(stats.watchSections)

    logger.debug('Set local video viewer stats for video %s.', video.uuid, { stats, ...lTags(video.uuid) })

    this.setLocalVideoViewer(sessionId, video.id, stats)
  }

  // ---------------------------------------------------------------------------

  async getWatchTime (videoId: number, sessionId: string) {
    const stats: LocalViewerStats = await this.getLocalVideoViewer({ sessionId, videoId })

    return stats?.watchTime || 0
  }

  // ---------------------------------------------------------------------------

  async processViewerStats () {
    if (this.processingViewersStats) return
    this.processingViewersStats = true

    if (!isTestOrDevInstance()) logger.info('Processing viewer statistics.', lTags())

    const now = new Date().getTime()

    try {
      await this.syncRedisWrites()

      const allKeys = await Redis.Instance.listLocalVideoViewerKeys()

      for (const key of allKeys) {
        const stats: LocalViewerStats = await this.getLocalVideoViewerByKey(key)

        // Process expired stats
        if (stats.lastUpdated > now - VIEW_LIFETIME.VIEWER_STATS) {
          continue
        }

        try {
          await sequelizeTypescript.transaction(async t => {
            const video = await VideoModel.load(stats.videoId, t)
            if (!video) return

            const statsModel = await this.saveViewerStats(video, stats, t)

            if (statsModel && video.remote) {
              await sendCreateWatchAction(statsModel, t)
            }
          })

          await this.deleteLocalVideoViewersKeys(key)
        } catch (err) {
          logger.error('Cannot process viewer stats for Redis key %s.', key, { err, stats, ...lTags() })
        }
      }
    } catch (err) {
      logger.error('Error in video save viewers stats scheduler.', { err, ...lTags() })
    }

    this.processingViewersStats = false
  }

  private async saveViewerStats (video: MVideo, stats: LocalViewerStats, transaction: Transaction) {
    if (stats.watchTime === 0) return

    const statsModel = new LocalVideoViewerModel({
      startDate: new Date(stats.firstUpdated),
      endDate: new Date(stats.lastUpdated),
      watchTime: stats.watchTime,
      country: stats.country,
      subdivisionName: stats.subdivisionName,
      videoId: video.id
    })

    statsModel.url = getLocalVideoViewerActivityPubUrl(statsModel)
    statsModel.Video = video as VideoModel

    await statsModel.save({ transaction })

    statsModel.WatchSections = await LocalVideoViewerWatchSectionModel.bulkCreateSections({
      localVideoViewerId: statsModel.id,
      watchSections: stats.watchSections,
      transaction
    })

    return statsModel
  }

  private buildWatchTimeFromSections (sections: { start: number, end: number }[]) {
    return sections.reduce((p, current) => p + (current.end - current.start), 0)
  }

  /**
   *
   *  Redis calls can be expensive so try to cache things in front of it
   *
   */

  private getLocalVideoViewer (options: {
    sessionId: string
    videoId: number
  }): Promise<LocalViewerStats> {
    const { viewerKey } = Redis.Instance.generateLocalVideoViewerKeys(options.sessionId, options.videoId)

    return this.getLocalVideoViewerByKey(viewerKey)
  }

  private getLocalVideoViewerByKey (key: string): Promise<LocalViewerStats> {
    const viewer = this.viewerCache.get(key)
    if (viewer) return Promise.resolve(viewer)

    return Redis.Instance.getLocalVideoViewer({ key })
  }

  private setLocalVideoViewer (sessionId: string, videoId: number, stats: LocalViewerStats) {
    const { viewerKey } = Redis.Instance.generateLocalVideoViewerKeys(sessionId, videoId)
    this.viewerCache.set(viewerKey, stats)

    this.redisPendingWrites.set(viewerKey, { sessionId, videoId, stats })
  }

  private deleteLocalVideoViewersKeys (key: string) {
    this.viewerCache.delete(key)

    return Redis.Instance.deleteLocalVideoViewersKeys(key)
  }

  private async syncRedisWrites () {
    if (this.processingRedisWrites) return

    this.processingRedisWrites = true

    for (const [ key, pendingWrite ] of this.redisPendingWrites) {
      const { sessionId, videoId, stats } = pendingWrite
      this.redisPendingWrites.delete(key)

      try {
        await Redis.Instance.setLocalVideoViewer(sessionId, videoId, stats)
      } catch (err) {
        logger.error('Cannot write viewer into redis', { sessionId, videoId, stats, err })
      }
    }

    this.processingRedisWrites = false
  }
}
