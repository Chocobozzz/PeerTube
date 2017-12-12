import { eachSeries } from 'async'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ActivityPubSignature } from '../../shared'
import { isSignatureVerified, logger } from '../helpers'
import { ACCEPT_HEADERS, ACTIVITY_PUB } from '../initializers'
import { fetchRemoteAccount, saveAccountAndServerIfNotExist } from '../lib/activitypub'
import { AccountModel } from '../models/account/account'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
  const signatureObject: ActivityPubSignature = req.body.signature

  logger.debug('Checking signature of account %s...', signatureObject.creator)

  let account = await AccountModel.loadByUrl(signatureObject.creator)

  // We don't have this account in our database, fetch it on remote
  if (!account) {
    account = await fetchRemoteAccount(signatureObject.creator)

    if (!account) {
      return res.sendStatus(403)
    }

    // Save our new account and its server in database
    await saveAccountAndServerIfNotExist(account)
  }

  const verified = await isSignatureVerified(account, req.body)
  if (verified === false) return res.sendStatus(403)

  res.locals.signature = {
    account
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
