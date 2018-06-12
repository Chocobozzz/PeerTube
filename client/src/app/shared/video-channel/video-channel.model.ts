import { VideoChannel as ServerVideoChannel } from '../../../../../shared/models/videos/video-channel.model'
import { Actor } from '../actor/actor.model'
import { Account } from '../../../../../shared/models/actors'

export class VideoChannel extends Actor implements ServerVideoChannel {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: Account
  ownerBy?: string
  ownerAvatarUrl?: string

  constructor (hash: ServerVideoChannel) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.support = hash.support
    this.isLocal = hash.isLocal

    if (hash.ownerAccount) {
      this.ownerAccount = hash.ownerAccount
      this.ownerBy = Actor.CREATE_BY_STRING(hash.ownerAccount.name, hash.ownerAccount.host)
      this.ownerAvatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.ownerAccount)
    }
  }
}
