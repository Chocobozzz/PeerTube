import { NextFunction, Request, Response } from 'express'
import { ActivityPubSignature } from '../../shared'
import { logger } from '../helpers/logger'
import { isHTTPSignatureVerified, isJsonLDSignatureVerified, parseHTTPSignature } from '../helpers/peertube-crypto'
import { ACCEPT_HEADERS, ACTIVITY_PUB, HTTP_SIGNATURE } from '../initializers'
import { getOrCreateActorAndServerAndModel } from '../lib/activitypub'
import { loadActorUrlOrGetFromWebfinger } from '../helpers/webfinger'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
  try {
    const httpSignatureChecked = await checkHttpSignature(req, res)
    if (httpSignatureChecked !== true) return

    const actor = res.locals.signature.actor

    // Forwarded activity
    const bodyActor = req.body.actor
    const bodyActorId = bodyActor && bodyActor.id ? bodyActor.id : bodyActor
    if (bodyActorId && bodyActorId !== actor.url) {
      const jsonLDSignatureChecked = await checkJsonLDSignature(req, res)
      if (jsonLDSignatureChecked !== true) return
    }

    return next()
  } catch (err) {
    logger.error('Error in ActivityPub signature checker.', err)
    return res.sendStatus(403)
  }
}

function executeIfActivityPub (req: Request, res: Response, next: NextFunction) {
  const accepted = req.accepts(ACCEPT_HEADERS)
  if (accepted === false || ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS.indexOf(accepted) === -1) {
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
  // FIXME: mastodon does not include the Signature scheme
  const sig = req.headers[HTTP_SIGNATURE.HEADER_NAME] as string
  if (sig && sig.startsWith('Signature ') === false) req.headers[HTTP_SIGNATURE.HEADER_NAME] = 'Signature ' + sig

  const parsed = parseHTTPSignature(req)

  const keyId = parsed.keyId
  if (!keyId) {
    res.sendStatus(403)
    return false
  }

  logger.debug('Checking HTTP signature of actor %s...', keyId)

  let [ actorUrl ] = keyId.split('#')
  if (actorUrl.startsWith('acct:')) {
    actorUrl = await loadActorUrlOrGetFromWebfinger(actorUrl.replace(/^acct:/, ''))
  }

  const actor = await getOrCreateActorAndServerAndModel(actorUrl)

  const verified = isHTTPSignatureVerified(parsed, actor)
  if (verified !== true) {
    res.sendStatus(403)
    return false
  }

  res.locals.signature = { actor }

  return true
}

async function checkJsonLDSignature (req: Request, res: Response) {
  const signatureObject: ActivityPubSignature = req.body.signature

  if (!signatureObject || !signatureObject.creator) {
    res.sendStatus(403)
    return false
  }

  const [ creator ] = signatureObject.creator.split('#')

  logger.debug('Checking JsonLD signature of actor %s...', creator)

  const actor = await getOrCreateActorAndServerAndModel(creator)
  const verified = await isJsonLDSignatureVerified(actor, req.body)

  if (verified !== true) {
    res.sendStatus(403)
    return false
  }

  res.locals.signature = { actor }

  return true
}
