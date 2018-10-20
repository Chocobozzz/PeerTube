import { buildSignedActivity } from '../../../../helpers/activitypub'
import { getServerActor } from '../../../../helpers/utils'
import { ActorModel } from '../../../../models/activitypub/actor'
import { sha256 } from '../../../../helpers/core-utils'
import { HTTP_SIGNATURE } from '../../../../initializers'

type Payload = { body: any, signatureActorId?: number }

async function computeBody (payload: Payload) {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')
    body = await buildSignedActivity(actorSignature, payload.body)
  }

  return body
}

async function buildSignedRequestOptions (payload: Payload) {
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
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId,
    key: actor.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  }
}

function buildGlobalHeaders (body: object) {
  const digest = 'SHA-256=' + sha256(JSON.stringify(body), 'base64')

  return {
    'Digest': digest
  }
}

export {
  buildGlobalHeaders,
  computeBody,
  buildSignedRequestOptions
}
