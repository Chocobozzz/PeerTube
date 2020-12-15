import { CONFIG } from '@server/initializers/config'
import { UserModel } from '@server/models/account/user'
import { ActorFollowModel } from '@server/models/activitypub/actor-follow'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy'
import { VideoModel } from '@server/models/video/video'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { VideoFileModel } from '@server/models/video/video-file'
import { ServerStats, VideoRedundancyStrategyWithManual } from '@shared/models'

class StatsManager {

  private static instance: StatsManager

  private readonly instanceStartDate = new Date()

  private inboxMessagesProcessed = 0
  private inboxMessagesWaiting = 0

  private constructor () {}

  updateInboxStats (inboxMessagesProcessed: number, inboxMessagesWaiting: number) {
    this.inboxMessagesProcessed = inboxMessagesProcessed
    this.inboxMessagesWaiting = inboxMessagesWaiting
  }

  async getStats () {
    const { totalLocalVideos, totalLocalVideoViews, totalVideos } = await VideoModel.getStats()
    const { totalLocalVideoComments, totalVideoComments } = await VideoCommentModel.getStats()
    const { totalUsers, totalDailyActiveUsers, totalWeeklyActiveUsers, totalMonthlyActiveUsers } = await UserModel.getStats()
    const { totalInstanceFollowers, totalInstanceFollowing } = await ActorFollowModel.getStats()
    const { totalLocalVideoFilesSize } = await VideoFileModel.getStats()

    const videosRedundancyStats = await this.buildRedundancyStats()

    const data: ServerStats = {
      totalLocalVideos,
      totalLocalVideoViews,
      totalLocalVideoFilesSize,
      totalLocalVideoComments,
      totalVideos,
      totalVideoComments,

      totalUsers,
      totalDailyActiveUsers,
      totalWeeklyActiveUsers,
      totalMonthlyActiveUsers,

      totalInstanceFollowers,
      totalInstanceFollowing,

      videosRedundancy: videosRedundancyStats,

      totalActivityPubMessagesProcessed: this.inboxMessagesProcessed,
      activityPubMessagesProcessedPerSecond: this.buildActivityPubMessagesProcessedPerSecond(),
      totalActivityPubMessagesWaiting: this.inboxMessagesWaiting
    }

    return data
  }

  private buildActivityPubMessagesProcessedPerSecond () {
    const now = new Date()
    const startedSeconds = (now.getTime() - this.instanceStartDate.getTime()) / 1000

    return this.inboxMessagesProcessed / startedSeconds
  }

  private buildRedundancyStats () {
    const strategies = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES
                                               .map(r => ({
                                                 strategy: r.strategy as VideoRedundancyStrategyWithManual,
                                                 size: r.size
                                               }))

    strategies.push({ strategy: 'manual', size: null })

    return Promise.all(
      strategies.map(r => {
        return VideoRedundancyModel.getStats(r.strategy)
          .then(stats => Object.assign(stats, { strategy: r.strategy, totalSize: r.size }))
      })
    )
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  StatsManager
}
