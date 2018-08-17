export interface VideoBlacklist {
  id: number
  createdAt: Date
  updatedAt: Date
  reason?: string

  video: {
    id: number
    name: string
    uuid: string
    description: string
    duration: number
    views: number
    likes: number
    dislikes: number
    nsfw: boolean
  }
}
