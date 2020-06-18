import { ActorModel } from '../models/activitypub/actor'
import * as Bluebird from 'bluebird'
import { MActorFull, MActorAccountChannelId } from '../types/models'

type ActorFetchByUrlType = 'all' | 'association-ids'

function fetchActorByUrl (url: string, fetchType: ActorFetchByUrlType): Bluebird<MActorFull | MActorAccountChannelId> {
  if (fetchType === 'all') return ActorModel.loadByUrlAndPopulateAccountAndChannel(url)

  if (fetchType === 'association-ids') return ActorModel.loadByUrl(url)
}

export {
  ActorFetchByUrlType,
  fetchActorByUrl
}
