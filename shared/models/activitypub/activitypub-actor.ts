export interface ActivityPubActor {
  '@context': any[]
  type: 'Person' | 'Application'
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

  uuid: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }

  // Not used
  // summary: string
  // icon: string[]
  // liked: string
}
