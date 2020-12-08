
import { ActorModel } from '../models/activitypub/actor'
import { MActorAccountChannelId, MActorFull } from '../types/models'

type ActorFetchByUrlType = 'all' | 'association-ids'

function fetchActorByUrl (url: string, fetchType: ActorFetchByUrlType): Promise<MActorFull | MActorAccountChannelId> {
  if (fetchType === 'all') return ActorModel.loadByUrlAndPopulateAccountAndChannel(url)

  if (fetchType === 'association-ids') return ActorModel.loadByUrl(url)
}

export {
  ActorFetchByUrlType,
  fetchActorByUrl
}
