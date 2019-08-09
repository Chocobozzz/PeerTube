import { Activity } from '../../shared/models/activitypub'
import { ActorModel } from '../models/activitypub/actor'
import { SignatureActorModel } from './models'

export type APProcessorOptions<T extends Activity> = {
  activity: T
  byActor: SignatureActorModel
  inboxActor?: ActorModel
  fromFetch?: boolean
}
