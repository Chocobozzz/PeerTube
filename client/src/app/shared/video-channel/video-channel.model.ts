import { VideoChannel as ServerVideoChannel } from '../../../../../shared/models/videos/video-channel.model'
import { Actor } from '../actor/actor.model'

export class VideoChannel extends Actor implements ServerVideoChannel {
  displayName: string
  description: string
  support: string
  isLocal: boolean
  ownerAccount?: {
    id: number
    uuid: string
  }

  constructor (hash: ServerVideoChannel) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.support = hash.support
    this.isLocal = hash.isLocal
    this.ownerAccount = hash.ownerAccount
  }
}
