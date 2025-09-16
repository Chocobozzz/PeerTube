import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { UserModel } from '../../user.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { UserNotificationSettingModel } from '../../user-notification-setting.js'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'

export class UserTableAttributes {
  @Memoize()
  getUserAttributes () {
    return UserModel.getSQLAttributes('UserModel').join(', ')
  }
  // ---------------------------------------------------------------------------

  @Memoize()
  getAccountAttributes () {
    return AccountModel.getSQLAttributes('Account', 'Account.').join(', ')
  }

  @Memoize()
  getAccountActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Account->Actor', `Account.Actor.`).join(', ')
  }

  @Memoize()
  getAccountServerAttributes () {
    return ServerModel.getSQLAttributes('Account->Actor->Server', `Account.Actor.Server.`).join(', ')
  }

  @Memoize()
  getAccountAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Account->Actor->Avatars', 'Account.Actor.Avatars.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLAttributes('Account->VideoChannels', 'Account.VideoChannels.').join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Account->VideoChannels->Actor', `Account.VideoChannels.Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLSummaryAttributes('Account->VideoChannels->Actor->Server', `Account.VideoChannels.Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Account->VideoChannels->Actor->Avatars', 'Account.VideoChannels.Actor.Avatars.').join(', ')
  }

  @Memoize()
  getChannelBannerAttributes () {
    return ActorImageModel.getSQLAttributes('Account->VideoChannels->Actor->Banners', 'Account.VideoChannels.Actor.Banners.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getPlaylistAttributes () {
    return VideoPlaylistModel.getSQLSummaryAttributes('Account->VideoPlaylists', 'Account.VideoPlaylists.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getNotificationSettingAttributes () {
    return UserNotificationSettingModel.getSQLAttributes('NotificationSetting', 'NotificationSetting.').join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getCollabAttributes () {
    return VideoChannelCollaboratorModel.getSQLAttributes('Account->Collabs', 'Account.Collabs.').join(', ')
  }

  @Memoize()
  getCollabChannelAttributes () {
    return VideoChannelModel.getSQLAttributes('Account->Collabs->Channel', 'Account.Collabs.Channel.').join(', ')
  }

  @Memoize()
  getCollabChannelActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Account->Collabs->Channel->Actor', 'Account.Collabs.Channel.Actor.').join(', ')
  }

  @Memoize()
  getCollabChannelActorServerAttributes () {
    return ServerModel.getSQLAttributes(
      'Account->Collabs->Channel->Actor->Server',
      'Account.Collabs.Channel.Actor.Server.'
    ).join(', ')
  }

  @Memoize()
  getCollabChannelActorAvatarAttributes () {
    return ActorImageModel.getSQLAttributes(
      'Account->Collabs->Channel->Actor->Avatars',
      'Account.Collabs.Channel.Actor.Avatars.'
    ).join(', ')
  }

  @Memoize()
  getCollabChannelActorBannerAttributes () {
    return ActorImageModel.getSQLAttributes(
      'Account->Collabs->Channel->Actor->Banners',
      'Account.Collabs.Channel.Actor.Banners.'
    ).join(', ')
  }
}
