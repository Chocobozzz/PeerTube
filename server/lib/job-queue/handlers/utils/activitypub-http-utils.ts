import { buildSignedActivity } from '../../../../helpers/activitypub'
import { getServerActor } from '../../../../helpers/utils'
import { ActorModel } from '../../../../models/activitypub/actor'

async function computeBody (payload: { body: any, signatureActorId?: number }) {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')
    body = await buildSignedActivity(actorSignature, payload.body)
  }

  return body
}

async function buildSignedRequestOptions (payload: { signatureActorId?: number }) {
  let actor: ActorModel | null
  if (payload.signatureActorId) {
    actor = await ActorModel.load(payload.signatureActorId)
    if (!actor) throw new Error('Unknown signature actor id.')
  } else {
    // We need to sign the request, so use the server
    actor = await getServerActor()
  }

  const keyId = actor.getWebfingerUrl()
  return {
    algorithm: 'rsa-sha256',
    authorizationHeaderName: 'Signature',
    keyId,
    key: actor.privateKey
  }
}

export {
  computeBody,
  buildSignedRequestOptions
}
