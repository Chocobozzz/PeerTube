import { createPrivateAndPublicKeys } from '@server/helpers/peertube-crypto.js'
import { MActor } from '@server/types/models/index.js'

export async function generateAndSaveActorKeys<T extends MActor> (actor: T) {
  const { publicKey, privateKey, ed25519PublicKey, ed25519PrivateKey } = await createPrivateAndPublicKeys()

  actor.publicKey = publicKey
  actor.privateKey = privateKey
  actor.ed25519PublicKey = ed25519PublicKey
  actor.ed25519PrivateKey = ed25519PrivateKey

  return actor.save()
}
