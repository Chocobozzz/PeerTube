import { VideoDetails } from './video-details.model'
import { VideoPrivacy } from '../../../../../shared/models/videos/video-privacy.enum'
import { VideoUpdate } from '../../../../../shared/models/videos'

export class VideoEdit implements VideoUpdate {
  category: number
  licence: number
  language: string
  description: string
  name: string
  tags: string[]
  nsfw: boolean
  commentsEnabled: boolean
  waitTranscoding: boolean
  channelId: number
  privacy: VideoPrivacy
  support: string
  thumbnailfile?: any
  previewfile?: any
  thumbnailUrl: string
  previewUrl: string
  uuid?: string
  id?: number

  constructor (videoDetails?: VideoDetails) {
    if (videoDetails) {
      this.id = videoDetails.id
      this.uuid = videoDetails.uuid
      this.category = videoDetails.category.id
      this.licence = videoDetails.licence.id
      this.language = videoDetails.language.id
      this.description = videoDetails.description
      this.name = videoDetails.name
      this.tags = videoDetails.tags
      this.nsfw = videoDetails.nsfw
      this.commentsEnabled = videoDetails.commentsEnabled
      this.waitTranscoding = videoDetails.waitTranscoding
      this.channelId = videoDetails.channel.id
      this.privacy = videoDetails.privacy.id
      this.support = videoDetails.support
      this.thumbnailUrl = videoDetails.thumbnailUrl
      this.previewUrl = videoDetails.previewUrl
    }
  }

  patch (values: Object) {
    Object.keys(values).forEach((key) => {
      this[ key ] = values[ key ]
    })
  }

  toJSON () {
    return {
      category: this.category,
      licence: this.licence,
      language: this.language,
      description: this.description,
      support: this.support,
      name: this.name,
      tags: this.tags,
      nsfw: this.nsfw,
      commentsEnabled: this.commentsEnabled,
      waitTranscoding: this.waitTranscoding,
      channelId: this.channelId,
      privacy: this.privacy
    }
  }
}
