import { getAbsoluteAPIUrl } from '@app/helpers'
import { Account as ServerAccount, ActorImage, VideoChannel as ServerVideoChannel, ViewsPerDate } from '@shared/models'
import { Actor } from '../account/actor.model'

export class VideoChannel extends Actor implements ServerVideoChannel {
  displayName: string
  description: string
  support: string

  isLocal: boolean

  nameWithHost: string
  nameWithHostForced: string

  // TODO: remove, deprecated in 4.2
  banner: never

  banners: ActorImage[]

  bannerUrl: string

  updatedAt: Date | string

  ownerAccount?: ServerAccount
  ownerBy?: string

  videosCount?: number

  viewsPerDay?: ViewsPerDate[]
  totalViews?: number

  static GET_ACTOR_AVATAR_URL (actor: { avatars: { width: number, url?: string, path: string }[] }, size: number) {
    return Actor.GET_ACTOR_AVATAR_URL(actor, size)
  }

  static GET_ACTOR_BANNER_URL (channel: ServerVideoChannel) {
    if (!channel || channel.banners.length === 0) {
      return ''
    }

    const banner = channel.banners[0]
    if (!banner) return ''

    if (banner.url) return banner.url
    return getAbsoluteAPIUrl() + banner.path
  }

  static GET_DEFAULT_AVATAR_URL (size: number) {
    if (size <= 48) {
      return `${window.location.origin}/client/assets/images/default-avatar-video-channel-48x48.png`
    }

    return `${window.location.origin}/client/assets/images/default-avatar-video-channel.png`
  }

  constructor (hash: Partial<ServerVideoChannel>) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.support = hash.support

    this.banners = hash.banners || []

    this.isLocal = hash.isLocal

    this.nameWithHost = Actor.CREATE_BY_STRING(this.name, this.host)
    this.nameWithHostForced = Actor.CREATE_BY_STRING(this.name, this.host, true)

    this.videosCount = hash.videosCount

    if (hash.updatedAt) this.updatedAt = new Date(hash.updatedAt.toString())

    if (hash.viewsPerDay) {
      this.viewsPerDay = hash.viewsPerDay.map(v => ({ ...v, date: new Date(v.date) }))
    }

    if (hash.totalViews !== null && hash.totalViews !== undefined) {
      this.totalViews = hash.totalViews
    }

    if (hash.ownerAccount) {
      this.ownerAccount = hash.ownerAccount
      this.ownerBy = Actor.CREATE_BY_STRING(hash.ownerAccount.name, hash.ownerAccount.host)
    }

    this.updateComputedAttributes()
  }

  updateAvatar (newAvatars: ActorImage[]) {
    this.avatars = newAvatars

    this.updateComputedAttributes()
  }

  resetAvatar () {
    this.updateAvatar([])
  }

  updateBanner (newBanners: ActorImage[]) {
    this.banners = newBanners

    this.updateComputedAttributes()
  }

  resetBanner () {
    this.updateBanner([])
  }

  updateComputedAttributes () {
    this.bannerUrl = VideoChannel.GET_ACTOR_BANNER_URL(this)
  }
}
