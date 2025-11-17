import { ActorImage, BlockStatus, Account as ServerAccount } from '@peertube/peertube-models'
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

  static GET_DEFAULT_AVATAR_URL (size?: number) {
    if (size && size <= 48) {
      return `${window.location.origin}/client/assets/images/default-avatar-account-48x48.png`
    }

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

  updateAvatar (newAvatars: ActorImage[]) {
    this.avatars = newAvatars
  }

  resetAvatar () {
    this.avatars = []
  }

  updateBlockStatus (blockStatus: BlockStatus) {
    this.mutedByInstance = blockStatus.accounts[this.nameWithHostForced].blockedByServer
    this.mutedByUser = blockStatus.accounts[this.nameWithHostForced].blockedByUser
    this.mutedServerByUser = blockStatus.hosts[this.host].blockedByUser
    this.mutedServerByInstance = blockStatus.hosts[this.host].blockedByServer
  }
}
