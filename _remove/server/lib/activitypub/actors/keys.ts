import { createPrivateAndPublicKeys } from '@server/helpers/peertube-crypto'
import { MActor } from '@server/types/models'

// Set account keys, this could be long so process after the account creation and do not block the client
async function generateAndSaveActorKeys <T extends MActor> (actor: T) {
  const { publicKey, privateKey } = await createPrivateAndPublicKeys()

  actor.publicKey = publicKey
  actor.privateKey = privateKey

  return actor.save()
}

export {
  generateAndSaveActorKeys
}
