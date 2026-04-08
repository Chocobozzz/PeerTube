import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { CommentAutomaticTagModel } from '@server/models/automatic-tag/comment-automatic-tag.js'
import { ServerModel } from '@server/models/server/server.js'
import { getAvatarsJSONAttributes } from '@server/models/shared/sql/actor-helpers.js'
import { buildSQLAttributes } from '@server/models/shared/table.js'
import { AutomaticTagModel } from '../../../automatic-tag/automatic-tag.js'
import { VideoChannelModel } from '../../video-channel.js'
import { VideoCommentModel } from '../../video-comment.js'

export class VideoCommentTableAttributes {
  @Memoize()
  getVideoCommentAttributes () {
    return VideoCommentModel.getSQLAttributes('VideoCommentModel').join(', ')
  }

  @Memoize()
  getVideoAttributes () {
    return [
      `"Video"."id" AS "Video.id"`,
      `"Video"."uuid" AS "Video.uuid"`,
      `"Video"."name" AS "Video.name"`
    ].join(', ')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getAvatarAttributesJSON () {
    return ActorImageModel.getSQLAttributesJSON().join(', ')
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
    return getAvatarsJSONAttributes('Account->Actor->')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getChannelAttributes () {
    return VideoChannelModel.getSQLSummaryAttributes('Video->VideoChannel', 'Video.VideoChannel.').join(', ')
  }

  @Memoize()
  getChannelActorAttributes () {
    return ActorModel.getSQLSummaryAttributes('Video->VideoChannel->Actor', `Video.VideoChannel.Actor.`).join(', ')
  }

  @Memoize()
  getChannelServerAttributes () {
    return ServerModel.getSQLAttributes('Video->VideoChannel->Actor->Server', `Video.VideoChannel.Actor.Server.`).join(', ')
  }

  @Memoize()
  getChannelAvatarAttributes () {
    return getAvatarsJSONAttributes('Video->VideoChannel->Actor->')
  }

  // ---------------------------------------------------------------------------

  @Memoize()
  getCommentAutomaticTagAttributes () {
    return buildSQLAttributes({
      model: CommentAutomaticTagModel,
      tableName: 'CommentAutomaticTags',
      aliasPrefix: 'CommentAutomaticTags.',
      idBuilder: [ 'commentId', 'automaticTagId', 'accountId' ]
    }).join(', ')
  }

  @Memoize()
  getAutomaticTagAttributes () {
    return buildSQLAttributes({
      model: AutomaticTagModel,
      tableName: 'CommentAutomaticTags->AutomaticTag',
      aliasPrefix: 'CommentAutomaticTags.AutomaticTag.'
    }).join(', ')
  }
}
