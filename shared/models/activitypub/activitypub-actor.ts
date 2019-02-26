import { ActivityPubAttributedTo } from './objects/common-objects'

export type ActivityPubActorType = 'Person' | 'Application' | 'Group'

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
  uuid: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }

  icon: {
    type: 'Image'
    mediaType: 'image/png'
    url: string
  }
}
