export interface BlacklistedVideo {
  id: number
  videoId: number
  createdAt: Date
}

export interface RestBlacklistedVideo {
  name: string
  uuid: string
  description: string
  duration: number
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
}

export interface RestBlacklistedVideoInstance extends BlacklistedVideo, RestBlacklistedVideo {
  updatedAt: Date
}
