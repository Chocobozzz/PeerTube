import { ParsedDraftSignature } from '@misskey-dev/node-http-message-signatures'
import { ActivityDelete, ActivityPubSignature, HttpStatusCode } from '@peertube/peertube-models'
import { isActorDeleteActivityValid, isActorTypeValid } from '@server/helpers/custom-validators/activitypub/actor.js'
import { isHTTPSignatureDigestValid, isHTTPSignatureVerified, parseHTTPSignature } from '@server/helpers/peertube-crypto.js'
import { getRemoteErrorLogLevel } from '@server/helpers/remote-errors.js'
import { getAPId } from '@server/lib/activitypub/activity.js'
import { wrapWithSpanAndContext } from '@server/lib/opentelemetry/tracing.js'
import { NextFunction, Request, Response } from 'express'
import { createLogger } from '../helpers/logger.js'
import { ACCEPT_HEADERS, ACTIVITY_PUB, HTTP_SIGNATURE, WEBSERVER } from '../initializers/constants.js'
import { getOrCreateAPActor, loadActorUrlOrGetFromWebfinger } from '../lib/activitypub/actors/index.js'

const logger = createLogger('ap')

export async function checkSignature (req: Request, res: Response, next: NextFunction) {
  try {
    const httpSignatureChecked = await checkHttpSignature(req, res)
    if (httpSignatureChecked !== true) return

    const actor = res.locals.signature.actor

    // Forwarded activity
    const bodyActor = req.body.actor
    const bodyActorId = getAPId(bodyActor)
    if (bodyActorId && bodyActorId !== actor.url) {
      const jsonLDSignatureChecked = await checkJsonLDSignature(req, res)
      if (jsonLDSignatureChecked !== true) return
    }

    return next()
  } catch (err) {
    const activity: ActivityDelete = req.body
    if (isActorDeleteActivityValid(activity) && activity.object === activity.actor) {
      logger.debug('Handling signature error on actor delete activity', { err })
      return res.status(HttpStatusCode.NO_CONTENT_204).end()
    }

    // Fetching the remote actor to check the signature can fail for reasons that are out of our control
    logger.log(getRemoteErrorLogLevel(err), 'Error in ActivityPub signature checker.', { err })

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'ActivityPub signature could not be checked'
    })
  }
}

export function executeIfActivityPub (req: Request, res: Response, next: NextFunction) {
  const accepted = req.accepts(ACCEPT_HEADERS)
  if (accepted === false || ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS.includes(accepted) === false) {
    // Bypass this route
    return next('route')
  }

  logger.debug('ActivityPub request for %s.', req.url)

  return next()
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkHttpSignature (req: Request, res: Response) {
  return wrapWithSpanAndContext('peertube.activitypub.checkHTTPSignature', async () => {
    if (checkInboxRequest(req, res) !== true) return false

    // Compatibility with http-signature < v1.3
    const sig = req.headers['signature'] as string
    if (sig?.startsWith('Signature ') === true) req.headers['signature'] = sig.replace(/^Signature /, '')

    let parsed: ParsedDraftSignature

    try {
      parsed = parseHTTPSignature(req)
    } catch (err) {
      logger.warn('Invalid signature because of exception in signature parser', { reqBody: req.body, err })

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('Cannot parse HTTP signature')
      })
      return false
    }

    // The digest is signed, but we have to ensure it's the digest of the body we received
    const digest = req.headers['digest'] as string
    if (!digest || !req.rawBody || isHTTPSignatureDigestValid(req.rawBody, digest) !== true) {
      logger.warn('Invalid digest in HTTP signature of %s', parsed.value?.keyId)

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('Invalid digest')
      })
      return false
    }

    const keyId = parsed.value?.keyId

    if (!keyId) {
      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('Invalid key ID'),
        data: {
          keyId
        }
      })
      return false
    }

    logger.debug('Checking HTTP signature of actor %s...', keyId)

    let [ actorUrl ] = keyId.split('#')
    if (actorUrl.startsWith('acct:')) {
      actorUrl = await loadActorUrlOrGetFromWebfinger(actorUrl.replace(/^acct:/, ''))
    }

    const actor = await getOrCreateAPActor(actorUrl)

    const verified = await isHTTPSignatureVerified(parsed, actor)

    if (verified !== true) {
      logger.warn('Signature from %s is invalid', actorUrl, { parsed })

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('Invalid signature'),
        data: {
          actorUrl
        }
      })
      return false
    }

    res.locals.signature = { actor }
    return true
  })
}

function checkInboxRequest (req: Request, res: Response) {
  if (isRequestForThisInstance(req) !== true) {
    logger.warn('Rejecting inbox request for host %s, expected %s.', req.headers['host'], WEBSERVER.HOST)

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Host of the request is not this instance')
    })
    return false
  }

  // Only JSON bodies go through the parser that gives us the raw body to check the digest
  if (!req.is(ACTIVITY_PUB.INBOX_CONTENT_TYPES)) {
    res.fail({
      status: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415,
      message: req.t('Unsupported content type')
    })
    return false
  }

  // The signature parser reads this header in priority: only support the Signature header
  if (req.headers['authorization']?.toLowerCase().startsWith('signature')) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('HTTP signature must be sent in the Signature header')
    })
    return false
  }

  return true
}

function isRequestForThisInstance (req: Request) {
  // Compare the raw header, because this is the one used by the signature
  return req.headers['host']?.toLowerCase() === WEBSERVER.HOST.toLowerCase()
}

async function checkJsonLDSignature (req: Request, res: Response) {
  // Lazy load the module as it's quite big with json.ld dependency
  const { compactJSONLDAndCheckSignature } = await import('../helpers/peertube-jsonld.js')

  return wrapWithSpanAndContext('peertube.activitypub.JSONLDSignature', async () => {
    const signatureObject: ActivityPubSignature = req.body.signature

    if (!signatureObject?.creator) {
      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Object and creator signature do not match'
      })
      return false
    }

    if (isJsonLDSignatureDateValid(signatureObject.created) !== true) {
      logger.warn('JSON-LD signature of %s has an invalid or too old date.', signatureObject.creator, { created: signatureObject.created })

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Signature date is invalid or too old'
      })
      return false
    }

    const [ creator ] = signatureObject.creator.split('#')

    logger.debug('Checking JsonLD signature of actor %s...', creator)

    const actor = await getOrCreateAPActor(creator)
    const verified = await compactJSONLDAndCheckSignature(actor, req)

    if (verified !== true) {
      logger.warn('Signature not verified.', req.body)

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Signature could not be verified'
      })
      return false
    }

    // Prevent replaying an old profile
    if (req.body.type === 'Update' && isActorTypeValid(req.body.object?.type)) {
      logger.warn('Rejecting forwarded update of actor %s.', creator)

      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Actor updates cannot be forwarded'
      })
      return false
    }

    res.locals.signature = { actor }
    return true
  })
}

function isJsonLDSignatureDateValid (created: Date) {
  const createdAt = new Date(created).getTime()
  if (isNaN(createdAt)) return false

  const now = new Date().getTime()

  return createdAt >= now - ACTIVITY_PUB.CHECK_JSON_LD_SIGNATURE.MAX_AGE &&
    createdAt <= now + HTTP_SIGNATURE.CLOCK_SKEW_SECONDS * 1000
}
