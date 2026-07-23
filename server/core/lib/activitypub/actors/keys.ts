import { createPrivateAndPublicKeys } from '@server/helpers/peertube-crypto.js'
import { MActor } from '@server/types/models/index.js'

export async function generateAndSaveActorKeys<T extends MActor> (actor: T) {
  const { publicKey, privateKey } = await createPrivateAndPublicKeys()

  actor.publicKey = publicKey
  actor.privateKey = privateKey

  return actor.save()
}
