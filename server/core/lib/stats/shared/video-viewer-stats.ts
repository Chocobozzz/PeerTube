import { VideoViewEvent } from '@peertube/peertube-models'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { GeoIP } from '@server/helpers/geo-ip.js'
import { createLogger } from '@server/helpers/logger.js'
import { MAX_LOCAL_VIEWER_WATCH_SECTIONS, VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { sendCreateWatchAction } from '@server/lib/activitypub/send/index.js'
import { getLocalVideoViewerActivityPubUrl } from '@server/lib/activitypub/url.js'
import { LocalVideoViewer, Redis } from '@server/lib/redis/index.js'
import { LocalVideoViewerWatchSectionModel } from '@server/models/stat/local-video-viewer-watch-section.js'
import { LocalVideoViewerModel } from '@server/models/stat/local-video-viewer.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'

const logger = createLogger('views')

export class VideoViewerStats {
  private processingViewersStats = false

  // Flushing viewer stats to PostgreSQL and federating WatchAction must be done by a single process
  private readonly enableDatabaseFlush: boolean

  constructor (options: { enableDatabaseFlush?: boolean } = {}) {
    this.enableDatabaseFlush = options.enableDatabaseFlush !== false

    if (this.enableDatabaseFlush) {
      setInterval(() => this.processViewerStats(), VIEW_LIFETIME.VIEWER_STATS)
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Merge a heartbeat of a viewer in Redis and return the watch time it now total
   *
   * Everything is stored in Redis: the watch sections of a session are merged by a Redis script
   * So heartbeats of the same viewer can be handled by any process
   */
  async addLocalViewer (options: {
    video: MVideoImmutable
    currentTime: number
    ip: string
    sessionId: string
    viewEvent?: VideoViewEvent
    client: string
    operatingSystem: string
    device: string
  }) {
    const { video, ip, viewEvent, currentTime, sessionId, client, operatingSystem, device } = options

    logger.debug('Adding local viewer to video stats %s.', video.uuid, {
      currentTime,
      viewEvent,
      sessionId,
      client,
      operatingSystem,
      device
    })

    const merge = (newViewer?: Record<string, string | number>) => {
      return Redis.Instance.mergeLocalVideoViewer({
        sessionId,
        videoId: video.id,
        now: new Date().getTime(),
        currentTime,
        isSeek: viewEvent === 'seek',
        maxWatchSections: MAX_LOCAL_VIEWER_WATCH_SECTIONS,
        newViewer
      })
    }

    let result = await merge()

    // Redis does not know this viewer yet: geolocate it and retry with everything needed to create it
    if (result.status === 'unknown-viewer') {
      const { country, subdivisionName } = await GeoIP.Instance.safeIPISOLookup(ip)

      result = await merge({ client, device, operatingSystem, country, subdivisionName, videoId: video.id })
    }

    if (result.status === 'too-many-watch-sections') {
      logger.warn('Too much watch section to store for a viewer, skipping this one', {
        currentTime,
        viewEvent,
        sessionId,
        client,
        operatingSystem,
        device
      })
    }

    return result.watchTime
  }

  // ---------------------------------------------------------------------------

  async processViewerStats () {
    if (this.processingViewersStats) return
    this.processingViewersStats = true

    if (!isTestOrDevInstance()) logger.info('Processing viewer statistics.')

    const now = new Date().getTime()

    try {
      const allKeys = await Redis.Instance.listLocalVideoViewerKeys()

      for (const key of allKeys) {
        const stats: LocalVideoViewer = await Redis.Instance.getLocalVideoViewer({ key })

        if (!stats) {
          logger.warn('Cannot read viewer stats for Redis key %s, removing invalid entry.', key)

          try {
            await Redis.Instance.deleteLocalVideoViewersKeys(key)
          } catch (err) {
            logger.error('Cannot delete invalid viewer stats for Redis key %s.', key, { err })
          }

          continue
        }

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

          await Redis.Instance.deleteLocalVideoViewersKeys(key)
        } catch (err) {
          logger.error('Cannot process viewer stats for Redis key %s.', key, { err, stats })
        }
      }
    } catch (err) {
      logger.error('Error in video save viewers stats scheduler.', { err })
    }

    this.processingViewersStats = false
  }

  private async saveViewerStats (video: MVideo, stats: LocalVideoViewer, transaction: Transaction) {
    if (stats.watchTime === 0) return

    const statsModel = new LocalVideoViewerModel({
      startDate: new Date(stats.firstUpdated),
      endDate: new Date(stats.lastUpdated),
      watchTime: stats.watchTime,
      client: stats.client,
      device: stats.device,
      operatingSystem: stats.operatingSystem,
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
}
