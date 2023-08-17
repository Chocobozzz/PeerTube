import { ContextType } from '@peertube/peertube-models'
import { signAndContextify } from '@server/helpers/activity-pub-utils.js'
import { HTTP_SIGNATURE } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { MActor } from '@server/types/models/index.js'
import { getContextFilter } from '../context.js'

type Payload <T> = { body: T, contextType: ContextType, signatureActorId?: number }

export async function computeBody <T> (
  payload: Payload<T>
): Promise<T | T & { type: 'RsaSignature2017', creator: string, created: string }> {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')

    body = await signAndContextify(actorSignature, payload.body, payload.contextType, getContextFilter())
  }

  return body
}

export async function buildSignedRequestOptions (options: {
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
