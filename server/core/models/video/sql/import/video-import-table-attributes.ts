import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { TagModel } from '../../tag.js'
import { ThumbnailModel } from '../../thumbnail.js'
import { VideoChannelModel } from '../../video-channel.js'
import { VideoImportModel } from '../../video-import.js'
import { VideoModel } from '../../video.js'

export class VideoImportTableAttributes {
  @Memoize()
  getVideoImportAttributes () {
    return VideoImportModel.getSQLAttributes('VideoImportModel').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getVideoAttributes () {
    return VideoModel.getSQLAttributes('Video', 'Video.').join(', ')
  }

  getVideoTagAttributes () {
    return TagModel.getSQLAttributes('Video->Tags', 'Video.Tags.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLAttributes('Video->VideoChannel', 'Video.VideoChannel.').join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('Video->VideoChannel->Actor', `Video.VideoChannel.Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Video->VideoChannel->Actor->Server', `Video.VideoChannel.Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Video->VideoChannel->Actor->Avatars', 'Video.VideoChannel.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getAccountAttributes () {
    return AccountModel.getSQLSummaryAttributes('Video->VideoChannel->Account', 'Video.VideoChannel.Account.').join(', ')
  }

  @Memoize()
  getAccountActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('Video->VideoChannel->Account->Actor', `Video.VideoChannel.Account.Actor.`).join(', ')
  }

  @Memoize()
  getAccountServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Video->VideoChannel->Account->Actor->Server', `Video.VideoChannel.Account.Actor.Server.`)
      .join(', ')
  }

  @Memoize()
  getAccountAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Video->VideoChannel->Account->Actor->Avatars', 'Video.VideoChannel.Account.Actor.Avatars.')
      .join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getThumbnailAttributes () {
    return ThumbnailModel.getSQLAttributes('Video->Thumbnails', 'Video.Thumbnails.').join(', ')
  }
}
