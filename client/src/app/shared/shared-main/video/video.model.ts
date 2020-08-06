import { AuthUser } from '@app/core'
import { User } from '@app/core/users/user.model'
import { durationToString, getAbsoluteAPIUrl, getAbsoluteEmbedUrl } from '@app/helpers'
import { peertubeTranslate } from '@shared/core-utils/i18n'
import {
  Avatar,
  ServerConfig,
  UserRight,
  Video as VideoServerModel,
  VideoConstant,
  VideoPrivacy,
  VideoScheduleUpdate,
  VideoState
} from '@shared/models'
import { Actor } from '../account/actor.model'

export class Video implements VideoServerModel {
  byVideoChannel: string
  byAccount: string

  accountAvatarUrl: string
  videoChannelAvatarUrl: string

  createdAt: Date
  updatedAt: Date
  publishedAt: Date
  originallyPublishedAt: Date | string
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

  url?: string

  views: number
  likes: number
  dislikes: number
  nsfw: boolean

  originInstanceUrl: string
  originInstanceHost: string

  waitTranscoding?: boolean
  state?: VideoConstant<VideoState>
  scheduledUpdate?: VideoScheduleUpdate
  blacklisted?: boolean
  blockedReason?: string

  account: {
    id: number
    name: string
    displayName: string
    url: string
    host: string
    avatar?: Avatar
  }

  channel: {
    id: number
    name: string
    displayName: string
    url: string
    host: string
    avatar?: Avatar
  }

  userHistory?: {
    currentTime: number
  }

  static buildClientUrl (videoUUID: string) {
    return '/videos/watch/' + videoUUID
  }

  constructor (hash: VideoServerModel, translations = {}) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    this.createdAt = new Date(hash.createdAt.toString())
    this.publishedAt = new Date(hash.publishedAt.toString())
    this.category = hash.category
    this.licence = hash.licence
    this.language = hash.language
    this.privacy = hash.privacy
    this.waitTranscoding = hash.waitTranscoding
    this.state = hash.state
    this.description = hash.description

    this.duration = hash.duration
    this.durationLabel = durationToString(hash.duration)

    this.id = hash.id
    this.uuid = hash.uuid

    this.isLocal = hash.isLocal
    this.name = hash.name

    this.thumbnailPath = hash.thumbnailPath
    this.thumbnailUrl = hash.thumbnailUrl || (absoluteAPIUrl + hash.thumbnailPath)

    this.previewPath = hash.previewPath
    this.previewUrl = hash.previewUrl || (absoluteAPIUrl + hash.previewPath)

    this.embedPath = hash.embedPath
    this.embedUrl = hash.embedUrl || (getAbsoluteEmbedUrl() + hash.embedPath)

    this.url = hash.url

    this.views = hash.views
    this.likes = hash.likes
    this.dislikes = hash.dislikes

    this.nsfw = hash.nsfw

    this.account = hash.account
    this.channel = hash.channel

    this.byAccount = Actor.CREATE_BY_STRING(hash.account.name, hash.account.host)
    this.byVideoChannel = Actor.CREATE_BY_STRING(hash.channel.name, hash.channel.host)
    this.accountAvatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.account)
    this.videoChannelAvatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.channel)

    this.category.label = peertubeTranslate(this.category.label, translations)
    this.licence.label = peertubeTranslate(this.licence.label, translations)
    this.language.label = peertubeTranslate(this.language.label, translations)
    this.privacy.label = peertubeTranslate(this.privacy.label, translations)

    this.scheduledUpdate = hash.scheduledUpdate
    this.originallyPublishedAt = hash.originallyPublishedAt ? new Date(hash.originallyPublishedAt.toString()) : null

    if (this.state) this.state.label = peertubeTranslate(this.state.label, translations)

    this.blacklisted = hash.blacklisted
    this.blockedReason = hash.blacklistedReason

    this.userHistory = hash.userHistory

    this.originInstanceHost = this.account.host
    this.originInstanceUrl = 'https://' + this.originInstanceHost
  }

  isVideoNSFWForUser (user: User, serverConfig: ServerConfig) {
    // Video is not NSFW, skip
    if (this.nsfw === false) return false

    // Return user setting if logged in
    if (user) return user.nsfwPolicy !== 'display'

    // Return default instance config
    return serverConfig.instance.defaultNSFWPolicy !== 'display'
  }

  isRemovableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.REMOVE_ANY_VIDEO))
  }

  isBlockableBy (user: AuthUser) {
    return this.blacklisted !== true && user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true
  }

  isUnblockableBy (user: AuthUser) {
    return this.blacklisted === true && user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true
  }

  isUpdatableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.UPDATE_ANY_VIDEO))
  }

  canBeDuplicatedBy (user: AuthUser) {
    return user && this.isLocal === false && user.hasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES)
  }
}
