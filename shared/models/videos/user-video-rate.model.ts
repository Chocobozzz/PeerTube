import { UserVideoRateType } from './user-video-rate.type'

export interface UserVideoRate {
  videoId: string
  rating: UserVideoRateType
}
