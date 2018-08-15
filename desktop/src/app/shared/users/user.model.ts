import {
  Account as AccountServerModel,
  hasUserRight,
  User as UserServerModel,
  UserRight,
  UserRole,
  VideoChannel
} from '../../../../../shared'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'
import { Account } from '@app/shared/account/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'

export type UserConstructorHash = {
  id: number,
  username: string,
  email: string,
  role: UserRole,
  videoQuota?: number,
  nsfwPolicy?: NSFWPolicyType,
  autoPlayVideo?: boolean,
  createdAt?: Date,
  account?: AccountServerModel,
  videoChannels?: VideoChannel[]

  blocked?: boolean
  blockedReason?: string
}
export class User implements UserServerModel {
  id: number
  username: string
  email: string
  role: UserRole
  nsfwPolicy: NSFWPolicyType
  autoPlayVideo: boolean
  videoQuota: number
  account: Account
  videoChannels: VideoChannel[]
  createdAt: Date

  blocked: boolean
  blockedReason?: string

  constructor (hash: UserConstructorHash) {
    this.id = hash.id
    this.username = hash.username
    this.email = hash.email
    this.role = hash.role

    this.videoChannels = hash.videoChannels
    this.videoQuota = hash.videoQuota
    this.nsfwPolicy = hash.nsfwPolicy
    this.autoPlayVideo = hash.autoPlayVideo
    this.createdAt = hash.createdAt
    this.blocked = hash.blocked
    this.blockedReason = hash.blockedReason

    if (hash.account !== undefined) {
      this.account = new Account(hash.account)
    }
  }

  get accountAvatarUrl () {
    if (!this.account) return ''

    return this.account.avatarUrl
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  patch (obj: UserServerModel) {
    for (const key of Object.keys(obj)) {
      this[key] = obj[key]
    }

    if (obj.account !== undefined) {
      this.account = new Account(obj.account)
    }
  }

  updateAccountAvatar (newAccountAvatar: Avatar) {
    this.account.updateAvatar(newAccountAvatar)
  }
}
