import express from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isLocalUrl } from '@server/lib/activitypub/url.js'
import { getServerActor } from '@server/models/application/application.js'
import { isRootActivityValid } from '../../../helpers/custom-validators/activitypub/activity.js'
import { createLogger } from '../../../helpers/logger.js'

const logger = createLogger()

async function activityPubValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  logger.debug('Checking activity pub parameters')

  if (!isRootActivityValid(req.body)) {
    logger.warn('Incorrect activity parameters.', { activity: req.body })
    return res.fail({ message: 'Incorrect activity' })
  }

  const serverActor = await getServerActor()
  const remoteActor = res.locals.signature.actor

  // Also check the actor URL and not only the server association
  // A remote actor row that carries our own host is inconsistent
  if (serverActor.id === remoteActor.id || remoteActor.serverId === null || isLocalUrl(remoteActor.url)) {
    logger.error('Receiving request in INBOX by ourselves!', req.body)
    return res.status(HttpStatusCode.CONFLICT_409).end()
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  activityPubValidator
}
