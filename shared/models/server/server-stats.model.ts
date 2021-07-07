import { VideoRedundancyStrategyWithManual } from '../redundancy'
export interface ServerStats {
  totalUsers: number
  totalDailyActiveUsers: number
  totalWeeklyActiveUsers: number
  totalMonthlyActiveUsers: number

  totalLocalVideos: number
  totalLocalVideoViews: number
  totalLocalVideoComments: number
  totalLocalVideoFilesSize: number

  totalVideos: number
  totalVideoComments: number

  totalLocalVideoChannels: number
  totalLocalDailyActiveVideoChannels: number
  totalLocalWeeklyActiveVideoChannels: number
  totalLocalMonthlyActiveVideoChannels: number

  totalLocalPlaylists: number

  totalInstanceFollowers: number
  totalInstanceFollowing: number

  videosRedundancy: VideosRedundancyStats[]

  totalActivityPubMessagesProcessed: number
  totalActivityPubMessagesSuccesses: number
  totalActivityPubMessagesErrors: number

  totalActivityPubCreateMessagesSuccesses: number
  totalActivityPubUpdateMessagesSuccesses: number
  totalActivityPubDeleteMessagesSuccesses: number
  totalActivityPubFollowMessagesSuccesses: number
  totalActivityPubAcceptMessagesSuccesses: number
  totalActivityPubRejectMessagesSuccesses: number
  totalActivityPubAnnounceMessagesSuccesses: number
  totalActivityPubUndoMessagesSuccesses: number
  totalActivityPubLikeMessagesSuccesses: number
  totalActivityPubDislikeMessagesSuccesses: number
  totalActivityPubFlagMessagesSuccesses: number
  totalActivityPubViewMessagesSuccesses: number

  totalActivityPubCreateMessagesErrors: number
  totalActivityPubUpdateMessagesErrors: number
  totalActivityPubDeleteMessagesErrors: number
  totalActivityPubFollowMessagesErrors: number
  totalActivityPubAcceptMessagesErrors: number
  totalActivityPubRejectMessagesErrors: number
  totalActivityPubAnnounceMessagesErrors: number
  totalActivityPubUndoMessagesErrors: number
  totalActivityPubLikeMessagesErrors: number
  totalActivityPubDislikeMessagesErrors: number
  totalActivityPubFlagMessagesErrors: number
  totalActivityPubViewMessagesErrors: number

  activityPubMessagesProcessedPerSecond: number
  totalActivityPubMessagesWaiting: number
}

export interface VideosRedundancyStats {
  strategy: VideoRedundancyStrategyWithManual
  totalSize: number
  totalUsed: number
  totalVideoFiles: number
  totalVideos: number
}
