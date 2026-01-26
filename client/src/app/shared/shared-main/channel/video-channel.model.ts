import { maxBy } from '@peertube/peertube-core-utils'
import { ActorImage, Account as ServerAccount, VideoChannel as ServerVideoChannel, ViewsPerDate } from '@peertube/peertube-models'
import { Actor } from '../account/actor.model'

export class VideoChannel extends Actor implements ServerVideoChannel {
  displayName: string
  description: string
  support: string

  nameWithHost: string
  nameWithHostForced: string

  banners: ActorImage[]

  bannerUrl: string

  updatedAt: Date | string

  ownerAccount?: ServerAccount
  ownerBy?: string

  videosCount?: number

  viewsPerDay?: ViewsPerDate[]
  totalViews?: number

  static GET_ACTOR_BANNER_URL (channel: Partial<Pick<ServerVideoChannel, 'banners'>>) {
    if (!channel || !Array.isArray(channel.banners) || channel.banners.length === 0) {
      return ''
    }

    const banner = maxBy(channel.banners, 'width')
    if (!banner) return ''

    return banner.fileUrl
  }

  static GET_DEFAULT_AVATAR_URL (size: number) {
    if (size <= 48) {
      return `${window.location.origin}/client/assets/images/default-avatar-video-channel-48x48.png`
    }

    return `${window.location.origin}/client/assets/images/default-avatar-video-channel.png`
  }

  static buildPublicUrl (channel: Pick<ServerVideoChannel, 'name' | 'host'>) {
    return `/c/${Actor.CREATE_BY_STRING(channel.name, channel.host)}`
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

  updateComputedAttributes () {
    this.bannerUrl = VideoChannel.GET_ACTOR_BANNER_URL(this)
  }
}
