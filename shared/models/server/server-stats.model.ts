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

  totalInstanceFollowers: number
  totalInstanceFollowing: number

  videosRedundancy: VideosRedundancyStats[]
}

export interface VideosRedundancyStats {
  strategy: VideoRedundancyStrategyWithManual
  totalSize: number
  totalUsed: number
  totalVideoFiles: number
  totalVideos: number
}
