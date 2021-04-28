import * as express from 'express'
import { param } from 'express-validator'
import { isActorNameValid } from '../../helpers/custom-validators/actor'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import {
  doesAccountNameWithHostExist,
  doesLocalAccountNameExist,
  doesVideoChannelNameWithHostExist,
  doesLocalVideoChannelNameExist
} from '../../helpers/middlewares'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const localActorValidator = [
  param('actorName').custom(isActorNameValid).withMessage('Should have a valid actor name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localActorValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const isAccount = await doesLocalAccountNameExist(req.params.actorName, res, false)
    const isVideoChannel = await doesLocalVideoChannelNameExist(req.params.actorName, res, false)

    if (!isAccount || !isVideoChannel) {
      res.status(HttpStatusCode.NOT_FOUND_404)
         .json({ error: 'Actor not found' })
    }

    return next()
  }
]

const actorNameWithHostGetValidator = [
  param('actorName').exists().withMessage('Should have an actor name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking actorNameWithHostGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const isAccount = await doesAccountNameWithHostExist(req.params.actorName, res, false)
    const isVideoChannel = await doesVideoChannelNameWithHostExist(req.params.actorName, res, false)

    if (!isAccount && !isVideoChannel) {
      res.status(HttpStatusCode.NOT_FOUND_404)
         .json({ error: 'Actor not found' })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  localActorValidator,
  actorNameWithHostGetValidator
}
