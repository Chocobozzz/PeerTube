import { Activity } from './activity'
import { ActivityPubCollection } from './activitypub-collection'
import { ActivityPubOrderedCollection } from './activitypub-ordered-collection'

export type RootActivity = Activity | ActivityPubCollection | ActivityPubOrderedCollection<Activity>
