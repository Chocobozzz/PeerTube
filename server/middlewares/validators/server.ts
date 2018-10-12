import * as express from 'express'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ServerModel } from '../../models/server/server'
import { body } from 'express-validator/check'

const serverGetValidator = [
  body('host').custom(isHostValid).withMessage('Should have a valid host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking serverGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const server = await ServerModel.loadByHost(req.body.host)
    if (!server) {
      return res.status(404)
         .send({ error: 'Server host not found.' })
         .end()
    }

    res.locals.server = server

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  serverGetValidator
}
