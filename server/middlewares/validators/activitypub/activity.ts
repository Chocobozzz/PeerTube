import * as express from 'express'
import { isRootActivityValid } from '../../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { getServerActor } from '@server/models/application/application'

async function activityPubValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  logger.debug('Checking activity pub parameters')

  if (!isRootActivityValid(req.body)) {
    logger.warn('Incorrect activity parameters.', { activity: req.body })
    return res.status(400).json({ error: 'Incorrect activity.' })
  }

  const serverActor = await getServerActor()
  const remoteActor = res.locals.signature.actor
  if (serverActor.id === remoteActor.id) {
    logger.error('Receiving request in INBOX by ourselves!', req.body)
    return res.status(409).end()
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  activityPubValidator
}
