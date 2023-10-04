import { Transaction } from 'sequelize'
import { VideoViewEvent } from '@peertube/peertube-models'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { GeoIP } from '@server/helpers/geo-ip.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { MAX_LOCAL_VIEWER_WATCH_SECTIONS, VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { sendCreateWatchAction } from '@server/lib/activitypub/send/index.js'
import { getLocalVideoViewerActivityPubUrl } from '@server/lib/activitypub/url.js'
import { Redis } from '@server/lib/redis.js'
import { VideoModel } from '@server/models/video/video.js'
import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section.js'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'

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

  videoId: number
}

export class VideoViewerStats {
  private processingViewersStats = false

  constructor () {
    setInterval(() => this.processViewerStats(), VIEW_LIFETIME.VIEWER_STATS)
  }

  // ---------------------------------------------------------------------------

  async addLocalViewer (options: {
    video: MVideoImmutable
    currentTime: number
    ip: string
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime } = options

    logger.debug('Adding local viewer to video stats %s.', video.uuid, { currentTime, viewEvent, ...lTags(video.uuid) })

    return this.updateLocalViewerStats({ video, viewEvent, currentTime, ip })
  }

  // ---------------------------------------------------------------------------

  async getWatchTime (videoId: number, ip: string) {
    const stats: LocalViewerStats = await Redis.Instance.getLocalVideoViewer({ ip, videoId })

    return stats?.watchTime || 0
  }

  // ---------------------------------------------------------------------------

  private async updateLocalViewerStats (options: {
    video: MVideoImmutable
    ip: string
    currentTime: number
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime } = options
    const nowMs = new Date().getTime()

    let stats: LocalViewerStats = await Redis.Instance.getLocalVideoViewer({ ip, videoId: video.id })

    if (stats && stats.watchSections.length >= MAX_LOCAL_VIEWER_WATCH_SECTIONS) {
      logger.warn('Too much watch section to store for a viewer, skipping this one', { currentTime, viewEvent, ...lTags(video.uuid) })
      return
    }

    if (!stats) {
      const country = await GeoIP.Instance.safeCountryISOLookup(ip)

      stats = {
        firstUpdated: nowMs,
        lastUpdated: nowMs,

        watchSections: [],

        watchTime: 0,

        country,
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

    await Redis.Instance.setLocalVideoViewer(ip, video.id, stats)
  }

  async processViewerStats () {
    if (this.processingViewersStats) return
    this.processingViewersStats = true

    if (!isTestOrDevInstance()) logger.info('Processing viewer statistics.', lTags())

    const now = new Date().getTime()

    try {
      const allKeys = await Redis.Instance.listLocalVideoViewerKeys()

      for (const key of allKeys) {
        const stats: LocalViewerStats = await Redis.Instance.getLocalVideoViewer({ key })

        // Process expired stats
        if (stats.lastUpdated > now - VIEW_LIFETIME.VIEWER_STATS) {
          continue
        }

        try {
          await sequelizeTypescript.transaction(async t => {
            const video = await VideoModel.load(stats.videoId, t)
            if (!video) return

            const statsModel = await this.saveViewerStats(video, stats, t)

            if (video.remote) {
              await sendCreateWatchAction(statsModel, t)
            }
          })

          await Redis.Instance.deleteLocalVideoViewersKeys(key)
        } catch (err) {
          logger.error('Cannot process viewer stats for Redis key %s.', key, { err, ...lTags() })
        }
      }
    } catch (err) {
      logger.error('Error in video save viewers stats scheduler.', { err, ...lTags() })
    }

    this.processingViewersStats = false
  }

  private async saveViewerStats (video: MVideo, stats: LocalViewerStats, transaction: Transaction) {
    const statsModel = new LocalVideoViewerModel({
      startDate: new Date(stats.firstUpdated),
      endDate: new Date(stats.lastUpdated),
      watchTime: stats.watchTime,
      country: stats.country,
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
}
