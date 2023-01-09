import { Memoize } from '@server/helpers/memoize'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { ServerModel } from '@server/models/server/server'
import { VideoCommentModel } from '../../video-comment'

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
    return ActorImageModel.getSQLAttributes('Account->Actor->Avatars', 'Account.Actor.Avatars.id').join(', ')
  }
}
