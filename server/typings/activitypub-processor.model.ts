import { Activity } from '../../shared/models/activitypub'
import { MActorDefault, MActorSignature } from './models'

export type APProcessorOptions<T extends Activity> = {
  activity: T
  byActor: MActorSignature
  inboxActor?: MActorDefault
  fromFetch?: boolean
}
