import { UserVideoRateType } from './user-video-rate.type'
import { Video } from '../video.model'

export interface AccountVideoRate {
  video: Video
  rating: UserVideoRateType
}
