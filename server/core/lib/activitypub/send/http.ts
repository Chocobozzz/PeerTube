import { ContextType } from '@peertube/peertube-models'
import { signAndContextify } from '@server/helpers/activity-pub-utils.js'
import { logger } from '@server/helpers/logger.js'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@server/initializers/constants.js'
import { buildDigestFromWorker, signJsonLDObjectFromWorker } from '@server/lib/worker/parent-process.js'
import { ActorReservedModel } from '@server/models/actor/actor-reserved.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { getContextFilter } from '../context.js'

type Payload<T> = { body: T, contextType: ContextType, signatureActorId?: number }

export async function computeBody<T> (
  payload: Payload<T>
): Promise<T | T & { type: 'RsaSignature2017', creator: string, created: string }> {
  let body = payload.body

  if (payload.signatureActorId) {
    const actorSignature = await loadActorForSignature(payload.signatureActorId)

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
  const actor = options.signatureActorId
    ? await loadActorForSignature(options.signatureActorId)
    : await getServerActor() // We need to sign the request, so use the server

  return {
    keyId: ActorModel.getPublicKeyUrl(actor.url),
    key: actor.privateKey,
    headers: options.hasPayload
      ? HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
      : HTTP_SIGNATURE.HEADERS_TO_SIGN_WITHOUT_PAYLOAD
  }
}

async function loadActorForSignature (actorId: number) {
  const actor = await ActorModel.load(actorId) ?? await ActorReservedModel.loadByActorId(actorId)
  if (!actor) throw new Error('Unknown signature actor id.')

  return actor
}
