import { Actor as ActorServer } from '../../../../../shared/models/actors/actor.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { getAbsoluteAPIUrl } from '@app/shared/misc/utils'

export abstract class Actor implements ActorServer {
  id: number
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string
  updatedAt: Date | string
  avatar: Avatar

  avatarUrl: string

  static GET_ACTOR_AVATAR_URL (actor: { avatar?: Avatar }) {
    if (actor?.avatar?.url) return actor.avatar.url

    if (actor && actor.avatar) {
      const absoluteAPIUrl = getAbsoluteAPIUrl()

      return absoluteAPIUrl + actor.avatar.path
    }

    return this.GET_DEFAULT_AVATAR_URL()
  }

  static GET_DEFAULT_AVATAR_URL () {
    return window.location.origin + '/client/assets/images/default-avatar.png'
  }

  static CREATE_BY_STRING (accountName: string, host: string, forceHostname = false) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()
    const thisHost = new URL(absoluteAPIUrl).host

    if (host.trim() === thisHost && !forceHostname) return accountName

    return accountName + '@' + host
  }

  protected constructor (hash: ActorServer) {
    this.id = hash.id
    this.url = hash.url
    this.name = hash.name
    this.host = hash.host
    this.followingCount = hash.followingCount
    this.followersCount = hash.followersCount
    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())
    this.avatar = hash.avatar

    this.updateComputedAttributes()
  }

  updateAvatar (newAvatar: Avatar) {
    this.avatar = newAvatar

    this.updateComputedAttributes()
  }

  private updateComputedAttributes () {
    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this)
  }
}
