import { getBackendHost } from '@app/helpers'
import { ActorImage, Actor as ServerActor } from '@peertube/peertube-models'

export abstract class Actor implements ServerActor {
  id: number
  name: string

  host: string
  url: string

  followingCount: number
  followersCount: number

  createdAt: Date | string

  avatars: ActorImage[]

  isLocal: boolean

  static GET_ACTOR_AVATAR_URL (actor: { avatars: Pick<ActorImage, 'width' | 'fileUrl'>[] }, size?: number) {
    const avatarsAscWidth = actor.avatars.sort((a, b) => a.width - b.width)

    const avatar = size && avatarsAscWidth.length > 1
      ? avatarsAscWidth.find(a => a.width >= size)
      : avatarsAscWidth[avatarsAscWidth.length - 1] // Biggest one

    if (!avatar) return ''

    return avatar.fileUrl
  }

  static CREATE_BY_STRING (accountName: string, host: string, forceHostname = false) {
    const thisHost = getBackendHost()

    if (host.trim() === thisHost && !forceHostname) return accountName

    return accountName + '@' + host
  }

  static IS_LOCAL (host: string) {
    const thisHost = getBackendHost()

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

    this.avatars = hash.avatars || []
    this.isLocal = Actor.IS_LOCAL(this.host)
  }
}
