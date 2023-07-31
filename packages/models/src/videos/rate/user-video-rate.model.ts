import { UserVideoRateType } from './user-video-rate.type.js'

export interface UserVideoRate {
  videoId: number
  rating: UserVideoRateType
}
