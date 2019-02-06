import { VideoRedundancyStrategy } from '../redundancy'

export interface ServerStats {
  totalUsers: number
  totalLocalVideos: number
  totalLocalVideoViews: number
  totalLocalVideoComments: number
  totalLocalVideoFilesSize: number

  totalVideos: number
  totalVideoComments: number

  totalInstanceFollowers: number
  totalInstanceFollowing: number

  videosRedundancy: {
    strategy: VideoRedundancyStrategy
    totalSize: number
    totalUsed: number
    totalVideoFiles: number
    totalVideos: number
  }[]
}
