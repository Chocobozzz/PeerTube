import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { ChangeOwnershipModel } from '../../change-ownership.js'
import { ThumbnailModel } from '../../thumbnail.js'
import { VideoChannelModel } from '../../video-channel.js'
import { VideoModel } from '../../video.js'

export class VideoChangeOwnershipTableAttributes {
  @Memoize()
  getChangeOwnershipAttributes () {
    return ChangeOwnershipModel.getSQLAttributes('ChangeOwnershipModel').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getInitiatorAttributes () {
    return AccountModel.getSQLAttributes('Initiator', 'Initiator.').join(', ')
  }

  @Memoize()
  getInitiatorActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Initiator->Actor', 'Initiator.Actor.').join(', ')
  }

  @Memoize()
  getInitiatorServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Initiator->Actor->Server', 'Initiator.Actor.Server.').join(', ')
  }

  @Memoize()
  getInitiatorAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Initiator->Actor->Avatars', 'Initiator.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getNextOwnerAttributes () {
    return AccountModel.getSQLAttributes('NextOwner', 'NextOwner.').join(', ')
  }

  @Memoize()
  getNextOwnerActorAttributes () {
    return ActorModel.getSQLAPIAttributes('NextOwner->Actor', 'NextOwner.Actor.').join(', ')
  }

  @Memoize()
  getNextOwnerServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('NextOwner->Actor->Server', 'NextOwner.Actor.Server.').join(', ')
  }

  @Memoize()
  getNextOwnerAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('NextOwner->Actor->Avatars', 'NextOwner.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------
  // Video joins
  // ---------------------------------------------------------------------------

  @Memoize()
  getVideoAttributes () {
    return VideoModel.getSQLSummaryAttributes('Video', 'Video.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getVideoChannelAttributes () {
    return VideoChannelModel.getSQLSummaryAttributes('Video->VideoChannel', 'Video.VideoChannel.').join(', ')
  }

  @Memoize()
  getVideoChannelActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('Video->VideoChannel->Actor', 'Video.VideoChannel.Actor.').join(', ')
  }

  @Memoize()
  getVideoChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Video->VideoChannel->Actor->Server', 'Video.VideoChannel.Actor.Server.').join(', ')
  }

  @Memoize()
  getVideoChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Video->VideoChannel->Actor->Avatars', 'Video.VideoChannel.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getThumbnailAttributes () {
    return ThumbnailModel.getSQLAttributes('Video->Thumbnails', 'Video.Thumbnails.').join(', ')
  }

  // ---------------------------------------------------------------------------
  // Channel joins
  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLSummaryAttributes('VideoChannel', 'VideoChannel.').join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('VideoChannel->Actor', 'VideoChannel.Actor.').join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('VideoChannel->Actor->Server', 'VideoChannel.Actor.Server.').join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('VideoChannel->Actor->Avatars', 'VideoChannel.Actor.Avatars.').join(', ')
  }
}
