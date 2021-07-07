import { getAbsoluteAPIUrl } from '@app/helpers'
import { Account as ServerAccount, ActorImage, VideoChannel as ServerVideoChannel, ViewsPerDate } from '@shared/models'
import { Account } from '../account/account.model'
import { Actor } from '../account/actor.model'

export class VideoChannel extends Actor implements ServerVideoChannel {
  displayName: string
  description: string
  support: string

  isLocal: boolean

  nameWithHost: string
  nameWithHostForced: string

  banner: ActorImage
  bannerUrl: string

  updatedAt: Date | string

  ownerAccount?: ServerAccount
  ownerBy?: string

  videosCount?: number

  viewsPerDay?: ViewsPerDate[]

  static GET_ACTOR_AVATAR_URL (actor: object) {
    return Actor.GET_ACTOR_AVATAR_URL(actor)
  }

  static GET_ACTOR_BANNER_URL (channel: ServerVideoChannel) {
    if (channel?.banner?.url) return channel.banner.url

    if (channel && channel.banner) {
      const absoluteAPIUrl = getAbsoluteAPIUrl()

      return absoluteAPIUrl + channel.banner.path
    }

    return ''
  }

  static GET_DEFAULT_AVATAR_URL () {
    return `${window.location.origin}/client/assets/images/default-avatar-videochannel.png`
  }

  constructor (hash: Partial<ServerVideoChannel>) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.support = hash.support

    this.banner = hash.banner

    this.isLocal = hash.isLocal

    this.nameWithHost = Actor.CREATE_BY_STRING(this.name, this.host)
    this.nameWithHostForced = Actor.CREATE_BY_STRING(this.name, this.host, true)

    this.videosCount = hash.videosCount

    if (hash.updatedAt) this.updatedAt = new Date(hash.updatedAt.toString())

    if (hash.viewsPerDay) {
      this.viewsPerDay = hash.viewsPerDay.map(v => ({ ...v, date: new Date(v.date) }))
    }

    if (hash.ownerAccount) {
      this.ownerAccount = hash.ownerAccount
      this.ownerBy = Actor.CREATE_BY_STRING(hash.ownerAccount.name, hash.ownerAccount.host)
    }

    this.updateComputedAttributes()
  }

  updateAvatar (newAvatar: ActorImage) {
    this.avatar = newAvatar

    this.updateComputedAttributes()
  }

  resetAvatar () {
    this.updateAvatar(null)
  }

  updateBanner (newBanner: ActorImage) {
    this.banner = newBanner

    this.updateComputedAttributes()
  }

  resetBanner () {
    this.updateBanner(null)
  }

  updateComputedAttributes () {
    this.bannerUrl = VideoChannel.GET_ACTOR_BANNER_URL(this)
  }
}
