export interface ActivityPubSignature {
  type: string
  created: Date
  creator: string
  signatureValue: string
}
