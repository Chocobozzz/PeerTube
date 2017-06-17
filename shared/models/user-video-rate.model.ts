export type VideoRateType = 'like' | 'dislike'
export type UserVideoRateType = 'like' | 'dislike' | 'none'

export interface UserVideoRate {
  videoId: string
  rating: UserVideoRateType
}
