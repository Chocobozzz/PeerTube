import { AuthUser } from '@app/core'
import { User } from '@app/core/users/user.model'
import { durationToString, getAbsoluteAPIUrl, getAbsoluteEmbedUrl } from '@app/helpers'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { buildVideoWatchPath, getAllFiles, peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  ActorImage,
  HTMLServerConfig,
  UserRight,
  VideoConstant,
  VideoFile,
  VideoPrivacy,
  VideoPrivacyType,
  VideoScheduleUpdate,
  Video as VideoServerModel,
  VideoSource,
  VideoState,
  VideoStateType,
  VideoStreamingPlaylist,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'

export class Video implements VideoServerModel {
  byVideoChannel: string
  byAccount: string

  createdAt: Date
  updatedAt: Date
  publishedAt: Date
  originallyPublishedAt: Date | string

  category: VideoConstant<number>
  licence: VideoConstant<number>
  language: VideoConstant<string>
  privacy: VideoConstant<VideoPrivacyType>

  truncatedDescription: string
  description: string

  duration: number
  durationLabel: string

  id: number
  uuid: string
  shortUUID: string

  isLocal: boolean

  name: string
  serverHost: string
  thumbnailPath: string
  thumbnailUrl: string

  aspectRatio: number

  isLive: boolean

  previewPath: string
  previewUrl: string

  embedPath: string
  embedUrl: string

  url: string

  views: number
  viewers: number

  likes: number
  dislikes: number
  nsfw: boolean

  originInstanceUrl: string
  originInstanceHost: string

  waitTranscoding?: boolean
  state?: VideoConstant<VideoStateType>
  scheduledUpdate?: VideoScheduleUpdate

  blacklisted?: boolean
  blacklistedReason?: string

  blockedOwner?: boolean
  blockedServer?: boolean

  account: {
    id: number
    name: string
    displayName: string
    url: string
    host: string

    avatars: ActorImage[]
  }

  channel: {
    id: number
    name: string
    displayName: string
    url: string
    host: string

    avatars: ActorImage[]
  }

  userHistory?: {
    currentTime: number
  }

  pluginData?: any

  streamingPlaylists?: VideoStreamingPlaylist[]
  files?: VideoFile[]

  videoSource?: VideoSource

  automaticTags?: string[]

  static buildWatchUrl (video: Partial<Pick<Video, 'uuid' | 'shortUUID'>>) {
    return buildVideoWatchPath({ shortUUID: video.shortUUID || video.uuid })
  }

  static buildUpdateUrl (video: Partial<Pick<Video, 'uuid' | 'shortUUID'>>) {
    return '/videos/update/' + (video.shortUUID || video.uuid)
  }

  constructor (hash: VideoServerModel, translations: { [ id: string ]: string } = {}) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    this.createdAt = new Date(hash.createdAt.toString())
    this.publishedAt = new Date(hash.publishedAt.toString())
    this.category = hash.category
    this.licence = hash.licence
    this.language = hash.language
    this.privacy = hash.privacy
    this.waitTranscoding = hash.waitTranscoding
    this.state = hash.state

    this.truncatedDescription = hash.truncatedDescription
    this.description = hash.description

    this.isLive = hash.isLive

    this.duration = hash.duration
    this.durationLabel = durationToString(hash.duration)

    this.id = hash.id
    this.uuid = hash.uuid
    this.shortUUID = hash.shortUUID

    this.isLocal = hash.isLocal
    this.name = hash.name

    this.thumbnailPath = hash.thumbnailPath
    this.thumbnailUrl = this.thumbnailPath
      ? hash.thumbnailUrl || (absoluteAPIUrl + hash.thumbnailPath)
      : null

    this.previewPath = hash.previewPath
    this.previewUrl = this.previewPath
      ? hash.previewUrl || (absoluteAPIUrl + hash.previewPath)
      : null

    this.embedPath = hash.embedPath
    this.embedUrl = hash.embedUrl || (getAbsoluteEmbedUrl() + hash.embedPath)

    this.url = hash.url

    this.views = hash.views
    this.viewers = hash.viewers
    this.likes = hash.likes
    this.dislikes = hash.dislikes

    this.nsfw = hash.nsfw

    this.account = hash.account
    this.channel = hash.channel

    this.byAccount = Actor.CREATE_BY_STRING(hash.account.name, hash.account.host)
    this.byVideoChannel = Actor.CREATE_BY_STRING(hash.channel.name, hash.channel.host)

    this.category.label = peertubeTranslate(this.category.label, translations)
    this.licence.label = peertubeTranslate(this.licence.label, translations)
    this.language.label = peertubeTranslate(this.language.label, translations)
    this.privacy.label = peertubeTranslate(this.privacy.label, translations)

    this.scheduledUpdate = hash.scheduledUpdate
    this.originallyPublishedAt = hash.originallyPublishedAt ? new Date(hash.originallyPublishedAt.toString()) : null

    if (this.state) this.state.label = peertubeTranslate(this.state.label, translations)

    this.blacklisted = hash.blacklisted
    this.blacklistedReason = hash.blacklistedReason

    this.blockedOwner = hash.blockedOwner
    this.blockedServer = hash.blockedServer

    this.streamingPlaylists = hash.streamingPlaylists
    this.files = hash.files
    this.videoSource = hash.videoSource

    this.userHistory = hash.userHistory

    this.originInstanceHost = this.account.host
    this.originInstanceUrl = 'https://' + this.originInstanceHost

    this.pluginData = hash.pluginData

    this.aspectRatio = hash.aspectRatio

    this.automaticTags = hash.automaticTags
  }

  isVideoNSFWForUser (user: User, serverConfig: HTMLServerConfig) {
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

  isEditableBy (user: AuthUser, videoStudioEnabled: boolean) {
    return videoStudioEnabled &&
      this.state?.id === VideoState.PUBLISHED &&
      this.isUpdatableBy(user)
  }

  // ---------------------------------------------------------------------------

  isOwner (user: AuthUser) {
    return user && this.isLocal === true && this.account.name === user.username
  }

  hasSeeAllVideosRight (user: AuthUser) {
    return user?.hasRight(UserRight.SEE_ALL_VIDEOS)
  }

  isOwnerOrHasSeeAllVideosRight (user: AuthUser) {
    return this.isOwner(user) || this.hasSeeAllVideosRight(user)
  }

  canRemoveOneFile (user: AuthUser) {
    return this.isLocal &&
      user && user.hasRight(UserRight.MANAGE_VIDEO_FILES) &&
      this.state.id !== VideoState.TO_TRANSCODE &&
      getAllFiles(this).length > 1
  }

  canRemoveAllHLSOrWebFiles (user: AuthUser) {
    return this.isLocal &&
      user && user.hasRight(UserRight.MANAGE_VIDEO_FILES) &&
      this.state.id !== VideoState.TO_TRANSCODE &&
      this.hasHLS() &&
      this.hasWebVideos()
  }

  // ---------------------------------------------------------------------------

  canRunTranscoding (user: AuthUser) {
    return this.isLocal &&
    !this.isLive &&
    user?.hasRight(UserRight.RUN_VIDEO_TRANSCODING) &&
    this.state?.id &&
    !this.transcodingAndTranscriptionIncompatibleStates().has(this.state.id)
  }

  canGenerateTranscription (user: AuthUser, transcriptionEnabled: boolean) {
    return transcriptionEnabled &&
      this.isLocal &&
      !this.isLive &&
      user.hasRight(UserRight.UPDATE_ANY_VIDEO) &&
      this.state?.id &&
      !this.transcodingAndTranscriptionIncompatibleStates().has(this.state.id)
  }

  private transcodingAndTranscriptionIncompatibleStates () {
    return new Set<VideoStateType>([
      VideoState.TO_IMPORT,
      VideoState.TO_EDIT,
      VideoState.TO_MOVE_TO_EXTERNAL_STORAGE,
      VideoState.TO_MOVE_TO_FILE_SYSTEM
    ])
  }

  // ---------------------------------------------------------------------------

  hasHLS () {
    return this.streamingPlaylists?.some(p => p.type === VideoStreamingPlaylistType.HLS)
  }

  hasWebVideos () {
    return this.files && this.files.length !== 0
  }

  isLiveInfoAvailableBy (user: AuthUser) {
    return this.isLive &&
      user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.GET_ANY_LIVE))
  }

  canBeDuplicatedBy (user: AuthUser) {
    return user && this.isLocal === false && user.hasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES)
  }

  canAccessPasswordProtectedVideoWithoutPassword (user: AuthUser) {
    return this.privacy.id === VideoPrivacy.PASSWORD_PROTECTED &&
      user &&
      this.isLocal === true &&
      (this.account.name === user.username || user.hasRight(UserRight.SEE_ALL_VIDEOS))
  }
}
