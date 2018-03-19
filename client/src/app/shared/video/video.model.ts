import { Account } from '@app/shared/account/account.model'
import { User } from '../'
import { Video as VideoServerModel } from '../../../../../shared'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { VideoConstant } from '../../../../../shared/models/videos/video.model'
import { getAbsoluteAPIUrl } from '../misc/utils'

export class Video implements VideoServerModel {
  by: string
  createdAt: Date
  updatedAt: Date
  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<number>
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
    this.category = hash.category
    this.licence = hash.licence
    this.language = hash.language
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

    this.by = Account.CREATE_BY_STRING(hash.account.name, hash.account.host)
  }

  isVideoNSFWForUser (user: User) {
    // If the video is NSFW and the user is not logged in, or the user does not want to display NSFW videos...
    return (this.nsfw && (!user || user.displayNSFW === false))
  }
}
