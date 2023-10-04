import { ActorModel } from '../../models/actor/actor.js'
import { MActorAccountChannelId, MActorFull } from '../../types/models/index.js'

type ActorLoadByUrlType = 'all' | 'association-ids'

function loadActorByUrl (url: string, fetchType: ActorLoadByUrlType): Promise<MActorFull | MActorAccountChannelId> {
  if (fetchType === 'all') return ActorModel.loadByUrlAndPopulateAccountAndChannel(url)

  if (fetchType === 'association-ids') return ActorModel.loadByUrl(url)
}

export {
  type ActorLoadByUrlType,

  loadActorByUrl
}
