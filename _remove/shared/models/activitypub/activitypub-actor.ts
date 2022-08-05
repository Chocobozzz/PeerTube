import { ActivityIconObject, ActivityPubAttributedTo } from './objects/common-objects'

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
  attributedTo: ActivityPubAttributedTo[]

  support?: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }

  image?: ActivityIconObject | ActivityIconObject[]

  icon?: ActivityIconObject | ActivityIconObject[]
  // TODO: migrate to `icon`, introduced in 4.2
  icons?: ActivityIconObject[]

  published?: string
}
