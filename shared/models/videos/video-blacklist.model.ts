export interface BlacklistedVideo {
  id: number
  videoId: number
  createdAt: Date
  updatedAt: Date
  name: string
  uuid: string
  description: string
  duration: number
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
}
