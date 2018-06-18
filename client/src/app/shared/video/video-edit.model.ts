import { VideoDetails } from './video-details.model'
import { VideoPrivacy } from '../../../../../shared/models/videos/video-privacy.enum'
import { VideoUpdate } from '../../../../../shared/models/videos'
import { VideoScheduleUpdate } from '../../../../../shared/models/videos/video-schedule-update.model'

export class VideoEdit implements VideoUpdate {
  static readonly SPECIAL_SCHEDULED_PRIVACY = -1

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
  scheduleUpdate?: VideoScheduleUpdate

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

      this.scheduleUpdate = videoDetails.scheduledUpdate
    }
  }

  patch (values: Object) {
    Object.keys(values).forEach((key) => {
      this[ key ] = values[ key ]
    })

    // If schedule publication, the video is private and will be changed to public privacy
    if (parseInt(values['privacy'], 10) === VideoEdit.SPECIAL_SCHEDULED_PRIVACY) {
      const updateAt = (values['schedulePublicationAt'] as Date)
      updateAt.setSeconds(0)

      this.privacy = VideoPrivacy.PRIVATE
      this.scheduleUpdate = {
        updateAt: updateAt.toISOString(),
        privacy: VideoPrivacy.PUBLIC
      }
    } else {
      this.scheduleUpdate = null
    }
  }

  toFormPatch () {
    const json = {
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

    // Special case if we scheduled an update
    if (this.scheduleUpdate) {
      Object.assign(json, {
        privacy: VideoEdit.SPECIAL_SCHEDULED_PRIVACY,
        schedulePublicationAt: new Date(this.scheduleUpdate.updateAt.toString())
      })
    }

    return json
  }
}
