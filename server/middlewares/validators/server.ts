import * as express from 'express'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isHostValid, isValidContactBody } from '../../helpers/custom-validators/servers'
import { ServerModel } from '../../models/server/server'
import { body } from 'express-validator'
import { isUserDisplayNameValid } from '../../helpers/custom-validators/users'
import { Redis } from '../../lib/redis'
import { CONFIG, isEmailEnabled } from '../../initializers/config'

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

const contactAdministratorValidator = [
  body('fromName')
    .custom(isUserDisplayNameValid).withMessage('Should have a valid name'),
  body('fromEmail')
    .isEmail().withMessage('Should have a valid email'),
  body('body')
    .custom(isValidContactBody).withMessage('Should have a valid body'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking contactAdministratorValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    if (CONFIG.CONTACT_FORM.ENABLED === false) {
      return res
        .status(409)
        .send({ error: 'Contact form is not enabled on this instance.' })
        .end()
    }

    if (isEmailEnabled() === false) {
      return res
        .status(409)
        .send({ error: 'Emailer is not enabled on this instance.' })
        .end()
    }

    if (await Redis.Instance.doesContactFormIpExist(req.ip)) {
      logger.info('Refusing a contact form by %s: already sent one recently.', req.ip)

      return res
        .status(403)
        .send({ error: 'You already sent a contact form recently.' })
        .end()
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  serverGetValidator,
  contactAdministratorValidator
}
