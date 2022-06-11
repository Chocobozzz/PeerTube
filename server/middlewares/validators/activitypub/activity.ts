import express from 'express'
import { getServerActor } from '@server/models/application/application'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { isRootActivityValid } from '../../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../../helpers/logger'

async function activityPubValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  logger.debug('Checking activity pub parameters')

  if (!isRootActivityValid(req.body)) {
    logger.warn('Incorrect activity parameters.', { activity: req.body })
    return res.fail({ message: 'Incorrect activity' })
  }

  const serverActor = await getServerActor()
  const remoteActor = res.locals.signature.actor
  if (serverActor.id === remoteActor.id || remoteActor.serverId === null) {
    logger.error('Receiving request in INBOX by ourselves!', req.body)
    return res.status(HttpStatusCode.CONFLICT_409).end()
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  activityPubValidator
}
