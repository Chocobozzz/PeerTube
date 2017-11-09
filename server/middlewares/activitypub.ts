import { Request, Response, NextFunction } from 'express'

import { database as db } from '../initializers'
import {
  logger,
  getAccountFromWebfinger,
  isSignatureVerified
} from '../helpers'
import { ActivityPubSignature } from '../../shared'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
  const signatureObject: ActivityPubSignature = req.body.signature

  logger.debug('Checking signature of account %s...', signatureObject.creator)

  let account = await db.Account.loadByUrl(signatureObject.creator)

  // We don't have this account in our database, fetch it on remote
  if (!account) {
    account = await getAccountFromWebfinger(signatureObject.creator)

    if (!account) {
      return res.sendStatus(403)
    }

    // Save our new account in database
    await account.save()
  }

  const verified = await isSignatureVerified(account, req.body)
  if (verified === false) return res.sendStatus(403)

  res.locals.signature.account = account

  return next()
}

function executeIfActivityPub (fun: any | any[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.header('Accept') !== 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"') {
      return next()
    }

    if (Array.isArray(fun) === true) {
      fun[0](req, res, next) // FIXME: doesn't work
    }

    return fun(req, res, next)
  }
}

// ---------------------------------------------------------------------------

export {
  checkSignature,
  executeIfActivityPub
}
