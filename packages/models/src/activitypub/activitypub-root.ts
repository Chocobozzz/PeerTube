import { Activity } from './activity.js'
import { ActivityPubCollection } from './activitypub-collection.js'
import { ActivityPubOrderedCollection } from './activitypub-ordered-collection.js'

export type RootActivity = Activity | ActivityPubCollection | ActivityPubOrderedCollection<Activity>
