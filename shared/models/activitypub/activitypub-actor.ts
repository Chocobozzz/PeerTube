import { ActivityPubAttributedTo } from './objects/common-objects'

export type ActivityPubActorType = 'Person' | 'Application' | 'Group'

export interface ActivityPubActor {
  '@context': any[]
  type: ActivityPubActorType
  id: string
  following: string
  followers: string
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

  uuid: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }

  // Not used
  // icon: string[]
  // liked: string
}
