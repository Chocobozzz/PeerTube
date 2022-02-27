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

  // TODO: remove, deprecated in 4.2
  avatar: never

  avatars: ActorImage[]

  isLocal: boolean

  static GET_ACTOR_AVATAR_URL (actor: { avatars: { width: number, url?: string, path: string }[] }, size: number) {
    const avatar = actor.avatars.sort((a, b) => a.width - b.width).find(a => a.width >= size)

    if (!avatar) return ''
    if (avatar.url) return avatar.url

    const absoluteAPIUrl = getAbsoluteAPIUrl()

    return absoluteAPIUrl + avatar.path
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

    this.avatars = hash.avatars
    this.isLocal = Actor.IS_LOCAL(this.host)
  }
}
