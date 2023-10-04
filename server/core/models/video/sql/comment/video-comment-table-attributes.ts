import { Memoize } from '@server/helpers/memoize.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { ServerModel } from '@server/models/server/server.js'
import { VideoCommentModel } from '../../video-comment.js'

export class VideoCommentTableAttributes {

  @Memoize()
  getVideoCommentAttributes () {
    return VideoCommentModel.getSQLAttributes('VideoCommentModel').join(', ')
  }

  @Memoize()
  getAccountAttributes () {
    return AccountModel.getSQLAttributes('Account', 'Account.').join(', ')
  }

  @Memoize()
  getVideoAttributes () {
    return [
      `"Video"."id" AS "Video.id"`,
      `"Video"."uuid" AS "Video.uuid"`,
      `"Video"."name" AS "Video.name"`
    ].join(', ')
  }

  @Memoize()
  getActorAttributes () {
    return ActorModel.getSQLAPIAttributes('Account->Actor', `Account.Actor.`).join(', ')
  }

  @Memoize()
  getServerAttributes () {
    return ServerModel.getSQLAttributes('Account->Actor->Server', `Account.Actor.Server.`).join(', ')
  }

  @Memoize()
  getAvatarAttributes () {
    return ActorImageModel.getSQLAttributes('Account->Actor->Avatars', 'Account.Actor.Avatars.').join(', ')
  }
}
