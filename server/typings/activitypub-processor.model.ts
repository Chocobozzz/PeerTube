import { Activity } from '../../shared/models/activitypub'
import { ActorModel } from '../models/activitypub/actor'

export type APProcessorOptions<T extends Activity> = {
  activity: T
  byActor: ActorModel
  inboxActor?: ActorModel
  fromFetch?: boolean
}
