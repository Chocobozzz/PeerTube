import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoChannelModel } from '../../video-channel.js'

export class VideoChannelTableAttributes {
  @Memoize()
  getVideoChannelAttributes () {
    return VideoChannelModel.getSQLAttributes('VideoChannelModel').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Actor', `Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Actor->Server', `Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Actor->Avatars', 'Actor.Avatars.').join(', ')
  }

  @Memoize()
  getChannelBannerAttributes () {
    return ActorImageModel.getSQLAttributes('Actor->Banners', 'Actor.Banners.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getAccountAttributes () {
    return AccountModel.getSQLSummaryAttributes('Account', 'Account.').join(', ')
  }

  @Memoize()
  getAccountActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('Account->Actor', `Account.Actor.`).join(', ')
  }

  @Memoize()
  getAccountServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Account->Actor->Server', `Account.Actor.Server.`).join(', ')
  }

  @Memoize()
  getAccountAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Account->Actor->Avatars', 'Account.Actor.Avatars.').join(', ')
  }
}
