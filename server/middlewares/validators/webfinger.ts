import * as express from 'express'
import { query } from 'express-validator/check'
import { logger } from '../../helpers'
import { isWebfingerResourceValid } from '../../helpers/custom-validators/webfinger'
import { AccountModel } from '../../models/account/account'
import { areValidationErrors } from './utils'

const webfingerValidator = [
  query('resource').custom(isWebfingerResourceValid).withMessage('Should have a valid webfinger resource'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking webfinger parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    // Remove 'acct:' from the beginning of the string
    const nameWithHost = req.query.resource.substr(5)
    const [ name ] = nameWithHost.split('@')

    const account = await AccountModel.loadLocalByName(name)
    if (!account) {
      return res.status(404)
        .send({ error: 'Account not found' })
        .end()
    }

    res.locals.account = account
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  webfingerValidator
}
