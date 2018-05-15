import { Actor as ActorServer } from '../../../../../shared/models/actors/actor.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { getAbsoluteAPIUrl } from '@app/shared/misc/utils'

export abstract class Actor implements ActorServer {
  id: number
  uuid: string
  url: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date | string
  updatedAt: Date | string
  avatar: Avatar

  avatarUrl: string

  static GET_ACTOR_AVATAR_URL (actor: { avatar: Avatar }) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    if (actor && actor.avatar) return absoluteAPIUrl + actor.avatar.path

    return window.location.origin + '/client/assets/images/default-avatar.png'
  }

  static CREATE_BY_STRING (accountName: string, host: string) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()
    const thisHost = new URL(absoluteAPIUrl).host

    if (host.trim() === thisHost) return accountName

    return accountName + '@' + host
  }

  protected constructor (hash: ActorServer) {
    this.id = hash.id
    this.uuid = hash.uuid
    this.url = hash.url
    this.name = hash.name
    this.host = hash.host
    this.followingCount = hash.followingCount
    this.followersCount = hash.followersCount
    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())
    this.avatar = hash.avatar

    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this)
  }
}
