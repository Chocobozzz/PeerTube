import { Memoize } from '@server/helpers/memoize'
import { ServerModel } from '@server/models/server/server'
import { ActorModel } from '../../actor'
import { ActorFollowModel } from '../../actor-follow'
import { ActorImageModel } from '../../actor-image'

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
