import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoChannelModel } from '../../video-channel.js'
import { VideoPlaylistModel } from '../../video-playlist.js'
import { ThumbnailModel } from '../../thumbnail.js'

export class VideoPlaylistTableAttributes {
  @Memoize()
  getVideoPlaylistAttributes () {
    return VideoPlaylistModel.getSQLAttributes('VideoPlaylistModel').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLSummaryAttributes('VideoChannel', 'VideoChannel.').join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('VideoChannel->Actor', `VideoChannel.Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('VideoChannel->Actor->Server', `VideoChannel.Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('VideoChannel->Actor->Avatars', 'VideoChannel.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getAccountAttributes () {
    return AccountModel.getSQLSummaryAttributes('OwnerAccount', 'OwnerAccount.').join(', ')
  }

  @Memoize()
  getAccountActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('OwnerAccount->Actor', `OwnerAccount.Actor.`).join(', ')
  }

  @Memoize()
  getAccountServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('OwnerAccount->Actor->Server', `OwnerAccount.Actor.Server.`).join(', ')
  }

  @Memoize()
  getAccountAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('OwnerAccount->Actor->Avatars', 'OwnerAccount.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getThumbnailAttributes () {
    return ThumbnailModel.getSQLAttributes('Thumbnail', 'Thumbnail.').join(', ')
  }
}
