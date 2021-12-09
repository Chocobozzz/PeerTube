import { getAbsoluteAPIUrl } from '@app/helpers'
import { Actor as ServerActor, ActorImage } from '@shared/models'

export abstract class Actor implements ServerActor {
  id: number
  name: string

  host: string
  url: string

  followingCount: number
  followersCount: number

  createdAt: Date | string

  avatar: ActorImage
  avatarMiniature: ActorImage

  isLocal: boolean

  static GET_ACTOR_AVATAR_URL (actor: { avatar?: { url?: string, path: string } }) {
    if (actor?.avatar?.url) return actor.avatar.url

    if (actor?.avatar) {
      const absoluteAPIUrl = getAbsoluteAPIUrl()

      return absoluteAPIUrl + actor.avatar.path
    }

    return ''
  }

  static GET_ACTOR_AVATAR_MINIATURE_URL (actor: { avatarMiniature?: { url?: string, path: string } }) {
    if (actor?.avatarMiniature?.url) return actor.avatarMiniature.url

    if (actor?.avatarMiniature) {
      const absoluteAPIUrl = getAbsoluteAPIUrl()

      return absoluteAPIUrl + actor.avatarMiniature.path
    }

    return ''
  }

  static CREATE_BY_STRING (accountName: string, host: string, forceHostname = false) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()
    const thisHost = new URL(absoluteAPIUrl).host

    if (host.trim() === thisHost && !forceHostname) return accountName

    return accountName + '@' + host
  }

  static IS_LOCAL (host: string) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()
    const thisHost = new URL(absoluteAPIUrl).host

    return host.trim() === thisHost
  }

  protected constructor (hash: Partial<ServerActor>) {
    this.id = hash.id
    this.url = hash.url ?? ''
    this.name = hash.name ?? ''
    this.host = hash.host ?? ''
    this.followingCount = hash.followingCount
    this.followersCount = hash.followersCount

    if (hash.createdAt) this.createdAt = new Date(hash.createdAt.toString())

    this.avatar = hash.avatar
    this.avatarMiniature = hash.avatarMiniature
    this.isLocal = Actor.IS_LOCAL(this.host)
  }
}
