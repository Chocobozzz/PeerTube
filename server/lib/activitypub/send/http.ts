import { buildDigest, signJsonLDObject } from '@server/helpers/peertube-crypto'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@server/initializers/constants'
import { ActorModel } from '@server/models/actor/actor'
import { getServerActor } from '@server/models/application/application'
import { MActor } from '@server/types/models'
import { ContextType } from '@shared/models/activitypub/context'
import { activityPubContextify } from '../context'

type Payload <T> = { body: T, contextType: ContextType, signatureActorId?: number }

async function computeBody <T> (
  payload: Payload<T>
): Promise<T | T & { type: 'RsaSignature2017', creator: string, created: string }> {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')

    body = await signAndContextify(actorSignature, payload.body, payload.contextType)
  }

  return body
}

async function buildSignedRequestOptions (options: {
  signatureActorId?: number
  hasPayload: boolean
}) {
  let actor: MActor | null

  if (options.signatureActorId) {
    actor = await ActorModel.load(options.signatureActorId)
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
    headers: options.hasPayload
      ? HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
      : HTTP_SIGNATURE.HEADERS_TO_SIGN_WITHOUT_PAYLOAD
  }
}

function buildGlobalHeaders (body: any) {
  return {
    'digest': buildDigest(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }
}

async function signAndContextify <T> (byActor: MActor, data: T, contextType: ContextType | null) {
  const activity = contextType
    ? await activityPubContextify(data, contextType)
    : data

  return signJsonLDObject(byActor, activity)
}

export {
  buildGlobalHeaders,
  computeBody,
  buildSignedRequestOptions,
  signAndContextify
}
