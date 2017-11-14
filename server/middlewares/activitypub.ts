import { NextFunction, Request, Response, RequestHandler } from 'express'
import { ActivityPubSignature } from '../../shared'
import { isSignatureVerified, logger } from '../helpers'
import { fetchRemoteAccountAndCreatePod } from '../helpers/activitypub'
import { database as db, ACTIVITY_PUB_ACCEPT_HEADER } from '../initializers'
import { each, eachSeries, waterfall } from 'async'

async function checkSignature (req: Request, res: Response, next: NextFunction) {
  const signatureObject: ActivityPubSignature = req.body.signature

  logger.debug('Checking signature of account %s...', signatureObject.creator)

  let account = await db.Account.loadByUrl(signatureObject.creator)

  // We don't have this account in our database, fetch it on remote
  if (!account) {
    const accountResult = await fetchRemoteAccountAndCreatePod(signatureObject.creator)

    if (!accountResult) {
      return res.sendStatus(403)
    }

    // Save our new account in database
    account = accountResult.account
    await account.save()
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
    if (req.header('Accept') !== ACTIVITY_PUB_ACCEPT_HEADER) {
      return next()
    }

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
