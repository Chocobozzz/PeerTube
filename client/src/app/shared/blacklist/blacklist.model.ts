import { RestBlacklistedVideoInstance } from '../../../../../shared'

export class Blacklist implements RestBlacklistedVideoInstance {
  id: number
  videoId: number
  name: string
  uuid: string
  description: string
  duration: number
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
  createdAt: Date
  updatedAt: Date

  constructor (hash: {
    id: number,
    videoId: number,
    name: string,
    uuid: string,
    description: string,
    duration: number,
    views: number,
    likes: number,
    dislikes: number,
    nsfw: boolean,
    createdAt: Date,
    updatedAt: Date
  }) {
    this.id = hash.id
    this.videoId = hash.videoId
    this.name = hash.name
    this.uuid = hash.uuid
    this.description = hash.description
    this.duration = hash.duration
    this.views = hash.views
    this.likes = hash.likes
    this.dislikes = hash.dislikes
    this.nsfw = hash.nsfw

    if (hash.createdAt) {
      this.createdAt = hash.createdAt
    }
    if (hash.updatedAt) {
      this.updatedAt = hash.updatedAt
    }
  }
}
