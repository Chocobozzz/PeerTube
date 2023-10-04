import express from 'express'
import { body } from 'express-validator'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isHostValid, isValidContactBody } from '../../helpers/custom-validators/servers.js'
import { isUserDisplayNameValid } from '../../helpers/custom-validators/users.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG, isEmailEnabled } from '../../initializers/config.js'
import { Redis } from '../../lib/redis.js'
import { ServerModel } from '../../models/server/server.js'
import { areValidationErrors } from './shared/index.js'

const serverGetValidator = [
  body('host').custom(isHostValid).withMessage('Should have a valid host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const server = await ServerModel.loadByHost(req.body.host)
    if (!server) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Server host not found.'
      })
    }

    res.locals.server = server

    return next()
  }
]

const contactAdministratorValidator = [
  body('fromName')
    .custom(isUserDisplayNameValid),
  body('fromEmail')
    .isEmail(),
  body('body')
    .custom(isValidContactBody),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (CONFIG.CONTACT_FORM.ENABLED === false) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Contact form is not enabled on this instance.'
      })
    }

    if (isEmailEnabled() === false) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'SMTP is not configured on this instance.'
      })
    }

    if (await Redis.Instance.doesContactFormIpExist(req.ip)) {
      logger.info('Refusing a contact form by %s: already sent one recently.', req.ip)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'You already sent a contact form recently.'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  serverGetValidator,
  contactAdministratorValidator
}
