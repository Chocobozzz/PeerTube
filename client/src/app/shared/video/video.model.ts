import { User } from '../'
import { Video as VideoServerModel, VideoPrivacy } from '../../../../../shared'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { VideoConstant } from '../../../../../shared/models/videos/video.model'
import { getAbsoluteAPIUrl } from '../misc/utils'
import { ServerConfig } from '../../../../../shared/models'
import { Actor } from '@app/shared/actor/actor.model'

export class Video implements VideoServerModel {
  by: string
  accountAvatarUrl: string
  createdAt: Date
  updatedAt: Date
  publishedAt: Date
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<string>
  privacy: VideoConstant<VideoPrivacy>
  description: string
  duration: number
  durationLabel: string
  id: number
  uuid: string
  isLocal: boolean
  name: string
  serverHost: string
  thumbnailPath: string
  thumbnailUrl: string
  previewPath: string
  previewUrl: string
  embedPath: string
  embedUrl: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean

  account: {
    id: number
    uuid: string
    name: string
    displayName: string
    url: string
    host: string
    avatar: Avatar
  }

  channel: {
    id: number
    uuid: string
    name: string
    displayName: string
    url: string
    host: string
    avatar: Avatar
  }

  private static createDurationString (duration: number) {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor(duration % 3600 / 60)
    const seconds = duration % 60

    const minutesPadding = minutes >= 10 ? '' : '0'
    const secondsPadding = seconds >= 10 ? '' : '0'
    const displayedHours = hours > 0 ? hours.toString() + ':' : ''

    return displayedHours + minutesPadding +
        minutes.toString() + ':' + secondsPadding + seconds.toString()
  }

  constructor (hash: VideoServerModel) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    this.createdAt = new Date(hash.createdAt.toString())
    this.publishedAt = new Date(hash.publishedAt.toString())
    this.category = hash.category
    this.licence = hash.licence
    this.language = hash.language
    this.privacy = hash.privacy
    this.description = hash.description
    this.duration = hash.duration
    this.durationLabel = Video.createDurationString(hash.duration)
    this.id = hash.id
    this.uuid = hash.uuid
    this.isLocal = hash.isLocal
    this.name = hash.name
    this.thumbnailPath = hash.thumbnailPath
    this.thumbnailUrl = absoluteAPIUrl + hash.thumbnailPath
    this.previewPath = hash.previewPath
    this.previewUrl = absoluteAPIUrl + hash.previewPath
    this.embedPath = hash.embedPath
    this.embedUrl = absoluteAPIUrl + hash.embedPath
    this.views = hash.views
    this.likes = hash.likes
    this.dislikes = hash.dislikes
    this.nsfw = hash.nsfw
    this.account = hash.account

    this.by = Actor.CREATE_BY_STRING(hash.account.name, hash.account.host)
    this.accountAvatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.account)
  }

  isVideoNSFWForUser (user: User, serverConfig: ServerConfig) {
    // Video is not NSFW, skip
    if (this.nsfw === false) return false

    // Return user setting if logged in
    if (user) return user.nsfwPolicy !== 'display'

    // Return default instance config
    return serverConfig.instance.defaultNSFWPolicy !== 'display'
  }
}
