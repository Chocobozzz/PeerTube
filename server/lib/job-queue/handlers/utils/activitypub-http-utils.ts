import { buildSignedActivity } from '../../../../helpers/activitypub'
import { ActorModel } from '../../../../models/activitypub/actor'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '../../../../initializers/constants'
import { MActor } from '../../../../types/models'
import { getServerActor } from '@server/models/application/application'
import { buildDigest } from '@server/helpers/peertube-crypto'
import { ContextType } from '@shared/models/activitypub/context'

type Payload = { body: any, contextType?: ContextType, signatureActorId?: number }

async function computeBody (payload: Payload) {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')
    body = await buildSignedActivity(actorSignature, payload.body, payload.contextType)
  }

  return body
}

async function buildSignedRequestOptions (payload: Payload) {
  let actor: MActor | null

  if (payload.signatureActorId) {
    actor = await ActorModel.load(payload.signatureActorId)
    if (!actor) throw new Error('Unknown signature actor id.')
  } else {
    // We need to sign the request, so use the server
    actor = await getServerActor()
  }

  const keyId = actor.url
  return {
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId,
    key: actor.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  }
}

function buildGlobalHeaders (body: any) {
  return {
    'Digest': buildDigest(body),
    'Content-Type': 'application/activity+json',
    'Accept': ACTIVITY_PUB.ACCEPT_HEADER
  }
}

export {
  buildGlobalHeaders,
  computeBody,
  buildSignedRequestOptions
}
