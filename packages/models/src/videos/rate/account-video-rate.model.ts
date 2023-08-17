import { UserVideoRateType } from './user-video-rate.type.js'
import { Video } from '../video.model.js'

export interface AccountVideoRate {
  video: Video
  rating: UserVideoRateType
}
