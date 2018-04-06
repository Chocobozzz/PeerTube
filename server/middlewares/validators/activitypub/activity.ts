import * as express from 'express'
import { body } from 'express-validator/check'
import { isRootActivityValid } from '../../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { getServerActor } from '../../../helpers/utils'
import { ActorModel } from '../../../models/activitypub/actor'
import { areValidationErrors } from '../utils'

async function activityPubValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  logger.debug('Checking activity pub parameters')

  if (!isRootActivityValid(req.body)) {
    logger.warn('Incorrect activity parameters.', { activity: req.body })
    return res.status(400).json({ error: 'Incorrect activity.' })
  }

  const serverActor = await getServerActor()
  const remoteActor = res.locals.signature.actor as ActorModel
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
