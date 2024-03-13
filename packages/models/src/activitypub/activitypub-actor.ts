import { ActivityIconObject, ActivityPubAttributedTo } from './objects/common-objects.js'

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
  url: string
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

  // For export
  likes?: string
  dislikes?: string
}
