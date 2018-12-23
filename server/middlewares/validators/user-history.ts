import * as express from 'express'
import 'express-validator'
import { body, param, query } from 'express-validator/check'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { areValidActorHandles, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { UserModel } from '../../models/account/user'
import { CONFIG } from '../../initializers'
import { isDateValid, toArray } from '../../helpers/custom-validators/misc'

const userHistoryRemoveValidator = [
  body('beforeDate')
    .optional()
    .custom(isDateValid).withMessage('Should have a valid before date'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userHistoryRemoveValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  userHistoryRemoveValidator
}
