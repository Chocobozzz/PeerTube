export interface ActivityPubSignature {
  type: 'GraphSignature2012'
  created: Date,
  creator: string
  signatureValue: string
}
