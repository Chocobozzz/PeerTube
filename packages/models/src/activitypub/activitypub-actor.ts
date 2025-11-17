import { ActivityIconObject, ActivityPubAttributedTo, ActivityUrlObject } from './objects/common-objects.js'

export type ActivityPubActorType = 'Person' | 'Application' | 'Group' | 'Service' | 'Organization'

export interface ActivityPubActor {
  '@context': any[]
  type: ActivityPubActorType
  id: string
  following: string
  followers: string
  playlists?: string
  inbox: string
  outbox: string
  preferredUsername: string
  url: ActivityUrlObject[]
  name: string
  endpoints: {
    sharedInbox: string
  }
  summary: string
  attributedTo?: ActivityPubAttributedTo[]

  support?: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }

  // Lemmy attribute for groups
  postingRestrictedToMods?: boolean

  image?: ActivityIconObject | ActivityIconObject[]
  icon?: ActivityIconObject | ActivityIconObject[]

  published?: string

  // Used by the user export feature
  likes?: string
  dislikes?: string

  // On channels only
  playerSettings?: string
}
