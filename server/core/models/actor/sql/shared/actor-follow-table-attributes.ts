import { Memoize } from '@server/helpers/memoize.js'
import { ServerModel } from '@server/models/server/server.js'
import { ActorModel } from '../../actor.js'
import { ActorFollowModel } from '../../actor-follow.js'
import { ActorImageModel } from '../../actor-image.js'

export class ActorFollowTableAttributes {

  @Memoize()
  getFollowAttributes () {
    return ActorFollowModel.getSQLAttributes('ActorFollowModel').join(', ')
  }

  @Memoize()
  getActorAttributes (actorTableName: string) {
    return ActorModel.getSQLAttributes(actorTableName, `${actorTableName}.`).join(', ')
  }

  @Memoize()
  getServerAttributes (actorTableName: string) {
    return ServerModel.getSQLAttributes(`${actorTableName}->Server`, `${actorTableName}.Server.`).join(', ')
  }

  @Memoize()
  getAvatarAttributes (actorTableName: string) {
    return ActorImageModel.getSQLAttributes(`${actorTableName}->Avatars`, `${actorTableName}.Avatars.`).join(', ')
  }
}
