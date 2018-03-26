import { eachSeries } from 'async'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ActivityPubSignature } from '../../shared'
import { logger } from '../helpers/logger'
import { isSignatureVerified } from '../helpers/peertube-crypto'
import { ACCEPT_HEADERS, ACTIVITY_PUB } from '../initializers'
import { getOrCreateActorAndServerAndModel } from '../lib/activitypub'
import { ActorModel } from '../models/activitypub/actor'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
  const signatureObject: ActivityPubSignature = req.body.signature

  const [ creator ] = signatureObject.creator.split('#')

  logger.debug('Checking signature of actor %s...', creator)

  let actor: ActorModel
  try {
    actor = await getOrCreateActorAndServerAndModel(creator)
  } catch (err) {
    logger.error('Cannot create remote actor and check signature.', { err })
    return res.sendStatus(403)
  }

  const verified = await isSignatureVerified(actor, req.body)
  if (verified === false) return res.sendStatus(403)

  res.locals.signature = {
    actor
  }

  return next()
}

function executeIfActivityPub (fun: RequestHandler | RequestHandler[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const accepted = req.accepts(ACCEPT_HEADERS)
    if (accepted === false || ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS.indexOf(accepted) === -1) {
      return next()
    }

    logger.debug('ActivityPub request for %s.', req.url)

    if (Array.isArray(fun) === true) {
      return eachSeries(fun as RequestHandler[], (f, cb) => {
        f(req, res, cb)
      }, next)
    }

    return (fun as RequestHandler)(req, res, next)
  }
}

// ---------------------------------------------------------------------------

export {
  checkSignature,
  executeIfActivityPub
}
