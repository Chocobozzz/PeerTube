export interface ActivityPubSignature {
  type: string
  created: Date
  creator: string
  signatureValue: string
}

// FEP-8b32: Object Integrity Proofs
export interface ActivityPubIntegrityProof {
  '@context'?: any
  type: 'DataIntegrityProof'
  cryptosuite: 'eddsa-jcs-2022'
  verificationMethod: string
  proofPurpose: 'assertionMethod'
  proofValue: string
  created?: string
  expires?: string
}

// FEP-521a: Representing actor's public keys
export interface ActivityPubMultikey {
  id: string
  type: 'Multikey'
  controller: string
  publicKeyMultibase: string
}
