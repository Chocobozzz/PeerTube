import * as express from 'express'
import { body } from 'express-validator/check'
import { isAvatarFile } from '../../helpers/custom-validators/users'
import { areValidationErrors } from './utils'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { logger } from '../../helpers/logger'

const updateAvatarValidator = [
  body('avatarfile').custom((value, { req }) => isAvatarFile(req.files)).withMessage(
    'This file is not supported or too large. Please, make sure it is of the following type : '
    + CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME.join(', ')
  ),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateAvatarValidator parameters', { files: req.files })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

export {
  updateAvatarValidator
}
