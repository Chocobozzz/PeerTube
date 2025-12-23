import Bluebird from 'bluebird'
import { CONFIG } from '@server/initializers/config.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoModel } from '@server/models/video/video.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { ActivityType, ServerStats, VideoRedundancyStrategyWithManual } from '@peertube/peertube-models'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { AbuseModel } from '@server/models/abuse/abuse.js'
import { pick } from '@peertube/peertube-core-utils'

class StatsManager {

  private static instance: StatsManager

  private readonly instanceStartDate = new Date()

  private readonly inboxMessages = {
    processed: 0,
    errors: 0,
    successes: 0,
    waiting: 0,
    errorsPerType: this.buildAPPerType(),
    successesPerType: this.buildAPPerType()
  }

  private constructor () {}

  updateInboxWaiting (inboxMessagesWaiting: number) {
    this.inboxMessages.waiting = inboxMessagesWaiting
  }

  addInboxProcessedSuccess (type: ActivityType) {
    this.inboxMessages.processed++
    this.inboxMessages.successes++
    this.inboxMessages.successesPerType[type]++
  }

  addInboxProcessedError (type: ActivityType) {
    this.inboxMessages.processed++
    this.inboxMessages.errors++
    this.inboxMessages.errorsPerType[type]++
  }

  async getStats () {
    const { totalLocalVideos, totalLocalVideoViews, totalVideos } = await VideoModel.getStats()
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

      ...this.buildAPStats()
    }

    return data
  }

  private buildActivityPubMessagesProcessedPerSecond () {
    const now = new Date()
    const startedSeconds = (now.getTime() - this.instanceStartDate.getTime()) / 1000

    return this.inboxMessages.processed / startedSeconds
  }

  private buildRedundancyStats () {
    const strategies = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES
                                               .map(r => ({
                                                 strategy: r.strategy as VideoRedundancyStrategyWithManual,
                                                 size: r.size
                                               }))

    strategies.push({ strategy: 'manual', size: null })

    return Bluebird.mapSeries(strategies, r => {
      return VideoRedundancyModel.getStats(r.strategy)
        .then(stats => Object.assign(stats, { strategy: r.strategy, totalSize: r.size }))
    })
  }

  private buildAPPerType () {
    return {
      Create: 0,
      Update: 0,
      Delete: 0,
      Follow: 0,
      Accept: 0,
      Reject: 0,
      Announce: 0,
      Undo: 0,
      Like: 0,
      Dislike: 0,
      Flag: 0,
      View: 0,
      ApproveReply: 0,
      RejectReply: 0
    }
  }

  private buildAPStats () {
    return {
      totalActivityPubMessagesProcessed: this.inboxMessages.processed,

      totalActivityPubMessagesSuccesses: this.inboxMessages.successes,

      // Dirty, but simpler and with type checking
      totalActivityPubCreateMessagesSuccesses: this.inboxMessages.successesPerType.Create,
      totalActivityPubUpdateMessagesSuccesses: this.inboxMessages.successesPerType.Update,
      totalActivityPubDeleteMessagesSuccesses: this.inboxMessages.successesPerType.Delete,
      totalActivityPubFollowMessagesSuccesses: this.inboxMessages.successesPerType.Follow,
      totalActivityPubAcceptMessagesSuccesses: this.inboxMessages.successesPerType.Accept,
      totalActivityPubRejectMessagesSuccesses: this.inboxMessages.successesPerType.Reject,
      totalActivityPubAnnounceMessagesSuccesses: this.inboxMessages.successesPerType.Announce,
      totalActivityPubUndoMessagesSuccesses: this.inboxMessages.successesPerType.Undo,
      totalActivityPubLikeMessagesSuccesses: this.inboxMessages.successesPerType.Like,
      totalActivityPubDislikeMessagesSuccesses: this.inboxMessages.successesPerType.Dislike,
      totalActivityPubFlagMessagesSuccesses: this.inboxMessages.successesPerType.Flag,
      totalActivityPubViewMessagesSuccesses: this.inboxMessages.successesPerType.View,
      totalActivityPubApproveReplyMessagesSuccesses: this.inboxMessages.successesPerType.ApproveReply,
      totalActivityPubRejectReplyMessagesSuccesses: this.inboxMessages.successesPerType.RejectReply,

      totalActivityPubCreateMessagesErrors: this.inboxMessages.errorsPerType.Create,
      totalActivityPubUpdateMessagesErrors: this.inboxMessages.errorsPerType.Update,
      totalActivityPubDeleteMessagesErrors: this.inboxMessages.errorsPerType.Delete,
      totalActivityPubFollowMessagesErrors: this.inboxMessages.errorsPerType.Follow,
      totalActivityPubAcceptMessagesErrors: this.inboxMessages.errorsPerType.Accept,
      totalActivityPubRejectMessagesErrors: this.inboxMessages.errorsPerType.Reject,
      totalActivityPubAnnounceMessagesErrors: this.inboxMessages.errorsPerType.Announce,
      totalActivityPubUndoMessagesErrors: this.inboxMessages.errorsPerType.Undo,
      totalActivityPubLikeMessagesErrors: this.inboxMessages.errorsPerType.Like,
      totalActivityPubDislikeMessagesErrors: this.inboxMessages.errorsPerType.Dislike,
      totalActivityPubFlagMessagesErrors: this.inboxMessages.errorsPerType.Flag,
      totalActivityPubViewMessagesErrors: this.inboxMessages.errorsPerType.View,
      totalActivityPubApproveReplyMessagesErrors: this.inboxMessages.errorsPerType.ApproveReply,
      totalActivityPubRejectReplyMessagesErrors: this.inboxMessages.errorsPerType.RejectReply,

      totalActivityPubMessagesErrors: this.inboxMessages.errors,

      activityPubMessagesProcessedPerSecond: this.buildActivityPubMessagesProcessedPerSecond(),
      totalActivityPubMessagesWaiting: this.inboxMessages.waiting
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
