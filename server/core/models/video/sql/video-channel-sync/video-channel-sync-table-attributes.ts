import { Memoize } from '@server/helpers/memoize.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoChannelSyncModel } from '../../video-channel-sync.js'
import { VideoChannelModel } from '../../video-channel.js'

export class VideoChannelSyncTableAttributes {
  @Memoize()
  getVideoChannelSyncAttributes () {
    return VideoChannelSyncModel.getSQLAttributes('VideoChannelSyncModel').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLSummaryAttributes('VideoChannel', `VideoChannel.`).join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLAPIAttributes('VideoChannel->Actor', `VideoChannel.Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('VideoChannel->Actor->Server', `VideoChannel.Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('VideoChannel->Actor->Avatars', 'VideoChannel.Actor.Avatars.').join(', ')
  }
}
