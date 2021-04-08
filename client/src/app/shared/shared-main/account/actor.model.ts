import { Actor as ActorServer, ActorImage } from '@shared/models'
import { getAbsoluteAPIUrl } from '@app/helpers'

export abstract class Actor implements ActorServer {
  id: number
  name: string

  host: string
  url: string

  followingCount: number
  followersCount: number

  createdAt: Date | string
  updatedAt: Date | string

  avatar: ActorImage
  avatarUrl: string

  isLocal: boolean

  static GET_ACTOR_AVATAR_URL (actor: { avatar?: { url?: string, path: string } }) {
    if (actor?.avatar?.url) return actor.avatar.url

    if (actor && actor.avatar) {
      const absoluteAPIUrl = getAbsoluteAPIUrl()

      return absoluteAPIUrl + actor.avatar.path
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

  protected constructor (hash: Partial<ActorServer>) {
    this.id = hash.id
    this.url = hash.url ?? ''
    this.name = hash.name ?? ''
    this.host = hash.host ?? ''
    this.followingCount = hash.followingCount
    this.followersCount = hash.followersCount

    if (hash.createdAt) this.createdAt = new Date(hash.createdAt.toString())
    if (hash.updatedAt) this.updatedAt = new Date(hash.updatedAt.toString())

    this.avatar = hash.avatar
    this.isLocal = Actor.IS_LOCAL(this.host)
  }
}
