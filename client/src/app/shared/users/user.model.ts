import {
  Account as AccountServerModel,
  hasUserRight,
  User as UserServerModel,
  UserRight,
  UserRole,
  VideoChannel
} from '../../../../../shared'
import { NSFWPolicyType } from '../../../../../shared/models/videos/nsfw-policy.type'
import { Actor } from '@app/shared/actor/actor.model'
import { Account } from '@app/shared/account/account.model'

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
  accountAvatarUrl: string

  constructor (hash: UserConstructorHash) {
    this.id = hash.id
    this.username = hash.username
    this.email = hash.email
    this.role = hash.role

    if (hash.account !== undefined) {
      this.account = new Account(hash.account)
    }

    if (hash.videoChannels !== undefined) {
      this.videoChannels = hash.videoChannels
    }

    if (hash.videoQuota !== undefined) {
      this.videoQuota = hash.videoQuota
    }

    if (hash.nsfwPolicy !== undefined) {
      this.nsfwPolicy = hash.nsfwPolicy
    }

    if (hash.autoPlayVideo !== undefined) {
      this.autoPlayVideo = hash.autoPlayVideo
    }

    if (hash.createdAt !== undefined) {
      this.createdAt = hash.createdAt
    }

    this.updateComputedAttributes()
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

    this.updateComputedAttributes()
  }

  private updateComputedAttributes () {
    this.accountAvatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.account)
  }
}
