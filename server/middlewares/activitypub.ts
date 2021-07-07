import { NextFunction, Request, Response } from 'express'
import { getAPId } from '@server/helpers/activitypub'
import { isActorDeleteActivityValid } from '@server/helpers/custom-validators/activitypub/actor'
import { ActivityDelete, ActivityPubSignature } from '../../shared'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'
import { logger } from '../helpers/logger'
import { isHTTPSignatureVerified, isJsonLDSignatureVerified, parseHTTPSignature } from '../helpers/peertube-crypto'
import { ACCEPT_HEADERS, ACTIVITY_PUB, HTTP_SIGNATURE } from '../initializers/constants'
import { getOrCreateAPActor, loadActorUrlOrGetFromWebfinger } from '../lib/activitypub/actors'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
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

    logger.warn('Error in ActivityPub signature checker.', { err })
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'ActivityPub signature could not be checked'
    })
  }
}

function executeIfActivityPub (req: Request, res: Response, next: NextFunction) {
  const accepted = req.accepts(ACCEPT_HEADERS)
  if (accepted === false || ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS.includes(accepted) === false) {
    // Bypass this route
    return next('route')
  }

  logger.debug('ActivityPub request for %s.', req.url)

  return next()
}

// ---------------------------------------------------------------------------

export {
  checkSignature,
  executeIfActivityPub,
  checkHttpSignature
}

// ---------------------------------------------------------------------------

async function checkHttpSignature (req: Request, res: Response) {
  // FIXME: compatibility with http-signature < v1.3
  const sig = req.headers[HTTP_SIGNATURE.HEADER_NAME] as string
  if (sig && sig.startsWith('Signature ') === true) req.headers[HTTP_SIGNATURE.HEADER_NAME] = sig.replace(/^Signature /, '')

  let parsed: any

  try {
    parsed = parseHTTPSignature(req, HTTP_SIGNATURE.CLOCK_SKEW_SECONDS)
  } catch (err) {
    logger.warn('Invalid signature because of exception in signature parser', { reqBody: req.body, err })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: err.message
    })
    return false
  }

  const keyId = parsed.keyId
  if (!keyId) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Invalid key ID',
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

  const verified = isHTTPSignatureVerified(parsed, actor)
  if (verified !== true) {
    logger.warn('Signature from %s is invalid', actorUrl, { parsed })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Invalid signature',
      data: {
        actorUrl
      }
    })
    return false
  }

  res.locals.signature = { actor }
  return true
}

async function checkJsonLDSignature (req: Request, res: Response) {
  const signatureObject: ActivityPubSignature = req.body.signature

  if (!signatureObject || !signatureObject.creator) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Object and creator signature do not match'
    })
    return false
  }

  const [ creator ] = signatureObject.creator.split('#')

  logger.debug('Checking JsonLD signature of actor %s...', creator)

  const actor = await getOrCreateAPActor(creator)
  const verified = await isJsonLDSignatureVerified(actor, req.body)

  if (verified !== true) {
    logger.warn('Signature not verified.', req.body)

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Signature could not be verified'
    })
    return false
  }

  res.locals.signature = { actor }
  return true
}
