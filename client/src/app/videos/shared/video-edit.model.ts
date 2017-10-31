import { VideoDetails } from './video-details.model'
import { VideoPrivacy } from '../../../../../shared/models/videos/video-privacy.enum'

export class VideoEdit {
  category: number
  licence: number
  language: number
  description: string
  name: string
  tags: string[]
  nsfw: boolean
  channel: number
  privacy: VideoPrivacy
  uuid?: string
  id?: number

  constructor (videoDetails: VideoDetails) {
    this.id = videoDetails.id
    this.uuid = videoDetails.uuid
    this.category = videoDetails.category
    this.licence = videoDetails.licence
    this.language = videoDetails.language
    this.description = videoDetails.description
    this.name = videoDetails.name
    this.tags = videoDetails.tags
    this.nsfw = videoDetails.nsfw
    this.channel = videoDetails.channel.id
    this.privacy = videoDetails.privacy
  }

  patch (values: Object) {
    Object.keys(values).forEach((key) => {
      this[key] = values[key]
    })
  }

  toJSON () {
    return {
      category: this.category,
      licence: this.licence,
      language: this.language,
      description: this.description,
      name: this.name,
      tags: this.tags,
      nsfw: this.nsfw,
      channel: this.channel,
      privacy: this.privacy
    }
  }
}
