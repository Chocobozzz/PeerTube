import { buildDigest } from '@server/helpers/peertube-crypto'
import { getServerActor } from '@server/models/application/application'
import { ContextType } from '@shared/models/activitypub/context'
import { buildSignedActivity } from '../../../../helpers/activitypub'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '../../../../initializers/constants'
import { ActorModel } from '../../../../models/actor/actor'
import { MActor } from '../../../../types/models'

type Payload <T> = { body: T, contextType?: ContextType, signatureActorId?: number }

async function computeBody <T> (
  payload: Payload<T>
): Promise<T | T & { type: 'RsaSignature2017', creator: string, created: string }> {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')

    body = await buildSignedActivity(actorSignature, payload.body, payload.contextType)
  }

  return body
}

async function buildSignedRequestOptions (payload: Payload<any>) {
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
    'digest': buildDigest(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }
}

export {
  buildGlobalHeaders,
  computeBody,
  buildSignedRequestOptions
}
