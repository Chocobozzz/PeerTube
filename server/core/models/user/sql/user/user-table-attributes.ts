import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ServerModel } from '@server/models/server/server.js'
import { getAvatarsJSONAttributes, getBannersJSONAttributes } from '@server/models/shared/sql/actor-helpers.js'
import { buildSQLAttributes } from '@server/models/shared/table.js'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { UserNotificationSettingModel } from '../../user-notification-setting.js'
import { UserModel } from '../../user.js'

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
  getAvatarAttributesJSON () {
    return ActorImageModel.getSQLAttributesJSON().join(', ')
  }

  @Memoize()
  getAccountAvatarAttributes () {
    return getAvatarsJSONAttributes('Account->Actor->')
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
    return getAvatarsJSONAttributes('Account->VideoChannels->Actor->')
  }

  @Memoize()
  getBannerAttributesJSON () {
    return ActorImageModel.getSQLAttributesJSON().join(', ')
  }

  @Memoize()
  getChannelBannerAttributes () {
    return getBannersJSONAttributes('Account->VideoChannels->Actor->')
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
    return getAvatarsJSONAttributes('Account->Collabs->Channel->Actor->')
  }

  @Memoize()
  getCollabChannelActorBannerAttributes () {
    return getBannersJSONAttributes('Account->Collabs->Channel->Actor->')
  }

  @Memoize()
  getCollabChannelAccountAttributes () {
    return buildSQLAttributes({
      model: AccountModel,
      tableName: 'Account->Collabs->Channel->Account',
      aliasPrefix: 'Account.Collabs.Channel.Account.',
      includeAttributes: [ 'id', 'name' ]
    }).join(', ')
  }

  @Memoize()
  getCollabChannelAccountActorAttributes () {
    return buildSQLAttributes({
      model: ActorModel,
      tableName: 'Account->Collabs->Channel->Account->Actor',
      aliasPrefix: 'Account.Collabs.Channel.Account.Actor.',
      includeAttributes: [ 'id', 'preferredUsername' ]
    }).join(', ')
  }
}
