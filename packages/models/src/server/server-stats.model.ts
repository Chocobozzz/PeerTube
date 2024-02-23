import { ActivityType } from '../activitypub/index.js'
import { VideoRedundancyStrategyWithManual } from '../redundancy/index.js'

type ActivityPubMessagesSuccess = Record<`totalActivityPub${ActivityType}MessagesSuccesses`, number>
type ActivityPubMessagesErrors = Record<`totalActivityPub${ActivityType}MessagesErrors`, number>

export interface ServerStats extends ActivityPubMessagesSuccess, ActivityPubMessagesErrors {
  totalUsers: number
  totalDailyActiveUsers: number
  totalWeeklyActiveUsers: number
  totalMonthlyActiveUsers: number

  totalModerators: number
  totalAdmins: number

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

  activityPubMessagesProcessedPerSecond: number
  totalActivityPubMessagesWaiting: number

  averageRegistrationRequestResponseTimeMs: number
  totalRegistrationRequestsProcessed: number
  totalRegistrationRequests: number

  averageAbuseResponseTimeMs: number
  totalAbusesProcessed: number
  totalAbuses: number
}

export interface VideosRedundancyStats {
  strategy: VideoRedundancyStrategyWithManual
  totalSize: number
  totalUsed: number
  totalVideoFiles: number
  totalVideos: number
}
