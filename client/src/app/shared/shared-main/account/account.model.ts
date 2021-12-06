import { Account as ServerAccount, ActorImage, BlockStatus } from '@shared/models'
import { Actor } from './actor.model'

export class Account extends Actor implements ServerAccount {
  displayName: string
  description: string

  updatedAt: Date | string

  nameWithHost: string
  nameWithHostForced: string

  mutedByUser: boolean
  mutedByInstance: boolean
  mutedServerByUser: boolean
  mutedServerByInstance: boolean

  userId?: number

  static GET_ACTOR_AVATAR_URL (actor: { avatar?: { url?: string, path: string } }) {
    return Actor.GET_ACTOR_AVATAR_URL(actor)
  }

  static GET_DEFAULT_AVATAR_URL () {
    return `${window.location.origin}/client/assets/images/default-avatar-account.png`
  }

  constructor (hash: ServerAccount) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.userId = hash.userId
    this.nameWithHost = Actor.CREATE_BY_STRING(this.name, this.host)
    this.nameWithHostForced = Actor.CREATE_BY_STRING(this.name, this.host, true)

    if (hash.updatedAt) this.updatedAt = new Date(hash.updatedAt.toString())

    this.mutedByUser = false
    this.mutedByInstance = false
    this.mutedServerByUser = false
    this.mutedServerByInstance = false
  }

  updateAvatar (newAvatar: ActorImage) {
    this.avatar = newAvatar
  }

  resetAvatar () {
    this.avatar = null
  }

  updateBlockStatus (blockStatus: BlockStatus) {
    this.mutedByInstance = blockStatus.accounts[this.nameWithHostForced].blockedByServer
    this.mutedByUser = blockStatus.accounts[this.nameWithHostForced].blockedByUser
    this.mutedServerByUser = blockStatus.hosts[this.host].blockedByUser
    this.mutedServerByInstance = blockStatus.hosts[this.host].blockedByServer
  }
}
