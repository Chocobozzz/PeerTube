import { ContextType } from '@peertube/peertube-models'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { MActor } from '@server/types/models/index.js'
import { getContextFilter } from '../context.js'
import { buildDigestFromWorker, signJsonLDObjectFromWorker } from '@server/lib/worker/parent-process.js'
import { signAndContextify } from '@server/helpers/activity-pub-utils.js'
import { logger } from '@server/helpers/logger.js'

type Payload <T> = { body: T, contextType: ContextType, signatureActorId?: number }

export async function computeBody <T> (
  payload: Payload<T>
): Promise<T | T & { type: 'RsaSignature2017', creator: string, created: string }> {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await ActorModel.load(payload.signatureActorId)
    if (!actorSignature) throw new Error('Unknown signature actor id.')

    try {
      body = await signAndContextify({
        byActor: { url: actorSignature.url, privateKey: actorSignature.privateKey },
        data: payload.body,
        contextType: payload.contextType,
        contextFilter: getContextFilter(),
        signerFunction: signJsonLDObjectFromWorker
      })
    } catch (err) {
      logger.error('Cannot sign and contextify body', { body, err })
    }
  }

  return body
}

export async function buildGlobalHTTPHeaders (body: any) {
  return {
    'digest': await buildDigestFromWorker(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }
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
