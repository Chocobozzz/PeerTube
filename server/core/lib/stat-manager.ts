import { pick, promiseMapSeries } from '@peertube/peertube-core-utils'
import { ActivityType, ServerStats, VideoRedundancyStrategyWithManual } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { AbuseModel } from '@server/models/abuse/abuse.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { Redis } from './redis/index.js'

const logger = createLogger()

class StatsManager {
  private static instance: StatsManager

  private readonly instanceStartDate = new Date()

  private constructor () {}

  async resetInboxStats () {
    await Redis.Instance.resetInboxStats(this.instanceStartDate.getTime())
  }

  async addInboxProcessed (type: ActivityType, success: boolean) {
    try {
      await Redis.Instance.addInboxProcessed(type, success)
    } catch (err) {
      logger.error('Cannot add inbox processed stat.', { err })
    }
  }

  getActivityPubMessagesWaiting () {
    return Redis.Instance.getInboxWaiting(SCHEDULER_INTERVALS_MS.UPDATE_INBOX_STATS * 3)
  }

  async getStats () {
    const { totalLocalVideos, totalLocalVideoViews, totalLocalVideoDownloads, totalVideos } = await VideoModel.getStats()
    const { totalLocalVideoComments, totalVideoComments } = await VideoCommentModel.getStats()
    const {
      totalUsers,
      totalDailyActiveUsers,
      totalWeeklyActiveUsers,
      totalMonthlyActiveUsers,
      totalAdmins,
      totalModerators
    } = await UserModel.getStats()
    const { totalInstanceFollowers, totalInstanceFollowing } = await ActorFollowModel.getStats()
    const { totalLocalVideoFilesSize } = await VideoFileModel.getStats()
    const {
      totalLocalVideoChannels,
      totalLocalDailyActiveVideoChannels,
      totalLocalWeeklyActiveVideoChannels,
      totalLocalMonthlyActiveVideoChannels
    } = await VideoChannelModel.getStats()
    const { totalLocalPlaylists } = await VideoPlaylistModel.getStats()

    const videosRedundancyStats = await this.buildRedundancyStats()

    const data: ServerStats = {
      totalUsers,
      totalDailyActiveUsers,
      totalWeeklyActiveUsers,
      totalMonthlyActiveUsers,

      totalModerators: CONFIG.STATS.TOTAL_MODERATORS.ENABLED
        ? totalModerators
        : null,

      totalAdmins: CONFIG.STATS.TOTAL_ADMINS.ENABLED
        ? totalAdmins
        : null,

      totalLocalVideos,
      totalLocalVideoViews,
      totalLocalVideoDownloads,
      totalLocalVideoComments,
      totalLocalVideoFilesSize,

      totalVideos,
      totalVideoComments,

      totalLocalVideoChannels,
      totalLocalDailyActiveVideoChannels,
      totalLocalWeeklyActiveVideoChannels,
      totalLocalMonthlyActiveVideoChannels,

      totalLocalPlaylists,

      totalInstanceFollowers,
      totalInstanceFollowing,

      videosRedundancy: videosRedundancyStats,

      ...await this.buildAbuseStats(),
      ...await this.buildRegistrationRequestsStats(),

      ...await this.buildAPStats()
    }

    return data
  }

  private buildRedundancyStats () {
    const strategies = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES
      .map(r => ({
        strategy: r.strategy as VideoRedundancyStrategyWithManual,
        size: r.size
      }))

    strategies.push({ strategy: 'manual', size: null })

    return promiseMapSeries(strategies, r => {
      return VideoRedundancyModel.getStats(r.strategy)
        .then(stats => Object.assign(stats, { strategy: r.strategy, totalSize: r.size }))
    })
  }

  private async buildAPStats () {
    const [ { startedAt, successesPerType, errorsPerType }, waiting ] = await Promise.all([
      Redis.Instance.getInboxStats(),
      this.getActivityPubMessagesWaiting()
    ])

    const sum = (perType: { [id in ActivityType]?: number }) => Object.values(perType).reduce((acc, v) => acc + v, 0)

    const successes = sum(successesPerType)
    const errors = sum(errorsPerType)
    const processed = successes + errors

    const startedSeconds = (Date.now() - (startedAt ?? this.instanceStartDate.getTime())) / 1000

    return {
      totalActivityPubMessagesProcessed: processed,

      totalActivityPubMessagesSuccesses: successes,

      // Dirty, but simpler and with type checking
      totalActivityPubCreateMessagesSuccesses: successesPerType.Create ?? 0,
      totalActivityPubUpdateMessagesSuccesses: successesPerType.Update ?? 0,
      totalActivityPubDeleteMessagesSuccesses: successesPerType.Delete ?? 0,
      totalActivityPubFollowMessagesSuccesses: successesPerType.Follow ?? 0,
      totalActivityPubAcceptMessagesSuccesses: successesPerType.Accept ?? 0,
      totalActivityPubRejectMessagesSuccesses: successesPerType.Reject ?? 0,
      totalActivityPubAnnounceMessagesSuccesses: successesPerType.Announce ?? 0,
      totalActivityPubUndoMessagesSuccesses: successesPerType.Undo ?? 0,
      totalActivityPubLikeMessagesSuccesses: successesPerType.Like ?? 0,
      totalActivityPubDislikeMessagesSuccesses: successesPerType.Dislike ?? 0,
      totalActivityPubFlagMessagesSuccesses: successesPerType.Flag ?? 0,
      totalActivityPubViewMessagesSuccesses: successesPerType.View ?? 0,
      totalActivityPubDownloadMessagesSuccesses: successesPerType.Download ?? 0,
      totalActivityPubApproveReplyMessagesSuccesses: successesPerType.ApproveReply ?? 0,
      totalActivityPubRejectReplyMessagesSuccesses: successesPerType.RejectReply ?? 0,

      totalActivityPubCreateMessagesErrors: errorsPerType.Create ?? 0,
      totalActivityPubUpdateMessagesErrors: errorsPerType.Update ?? 0,
      totalActivityPubDeleteMessagesErrors: errorsPerType.Delete ?? 0,
      totalActivityPubFollowMessagesErrors: errorsPerType.Follow ?? 0,
      totalActivityPubAcceptMessagesErrors: errorsPerType.Accept ?? 0,
      totalActivityPubRejectMessagesErrors: errorsPerType.Reject ?? 0,
      totalActivityPubAnnounceMessagesErrors: errorsPerType.Announce ?? 0,
      totalActivityPubUndoMessagesErrors: errorsPerType.Undo ?? 0,
      totalActivityPubLikeMessagesErrors: errorsPerType.Like ?? 0,
      totalActivityPubDislikeMessagesErrors: errorsPerType.Dislike ?? 0,
      totalActivityPubFlagMessagesErrors: errorsPerType.Flag ?? 0,
      totalActivityPubViewMessagesErrors: errorsPerType.View ?? 0,
      totalActivityPubDownloadMessagesErrors: errorsPerType.Download ?? 0,
      totalActivityPubApproveReplyMessagesErrors: errorsPerType.ApproveReply ?? 0,
      totalActivityPubRejectReplyMessagesErrors: errorsPerType.RejectReply ?? 0,

      totalActivityPubMessagesErrors: errors,

      activityPubMessagesProcessedPerSecond: processed / startedSeconds,
      totalActivityPubMessagesWaiting: waiting
    }
  }

  private async buildRegistrationRequestsStats () {
    if (!CONFIG.STATS.REGISTRATION_REQUESTS.ENABLED) {
      return {
        averageRegistrationRequestResponseTimeMs: null,
        totalRegistrationRequests: null,
        totalRegistrationRequestsProcessed: null
      }
    }

    const res = await UserRegistrationModel.getStats()

    return pick(res, [ 'averageRegistrationRequestResponseTimeMs', 'totalRegistrationRequests', 'totalRegistrationRequestsProcessed' ])
  }

  private async buildAbuseStats () {
    if (!CONFIG.STATS.ABUSES.ENABLED) {
      return {
        averageAbuseResponseTimeMs: null,
        totalAbuses: null,
        totalAbusesProcessed: null
      }
    }

    const res = await AbuseModel.getStats()

    return pick(res, [ 'averageAbuseResponseTimeMs', 'totalAbuses', 'totalAbusesProcessed' ])
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  StatsManager
}
