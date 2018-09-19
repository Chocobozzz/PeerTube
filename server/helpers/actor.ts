import { ActorModel } from '../models/activitypub/actor'

type ActorFetchByUrlType = 'all' | 'actor-and-association-ids'
function fetchActorByUrl (url: string, fetchType: ActorFetchByUrlType) {
  if (fetchType === 'all') return ActorModel.loadByUrlAndPopulateAccountAndChannel(url)

  if (fetchType === 'actor-and-association-ids') return ActorModel.loadByUrl(url)
}

export {
  ActorFetchByUrlType,
  fetchActorByUrl
}
