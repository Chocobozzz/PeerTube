import * as express from 'express'
import { body } from 'express-validator/check'
import { isRootActivityValid } from '../../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { getServerActor } from '../../../helpers/utils'
import { ActorModel } from '../../../models/activitypub/actor'
import { areValidationErrors } from '../utils'

const activityPubValidator = [
  body('').custom((value, { req }) => isRootActivityValid(req.body)),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking activity pub parameters')

    if (areValidationErrors(req, res)) return

    const serverActor = await getServerActor()
    const remoteActor = res.locals.signature.actor as ActorModel
    if (serverActor.id === remoteActor.id) {
      logger.error('Receiving request in INBOX by ourselves!', req.body)
      return res.sendStatus(409)
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  activityPubValidator
}
