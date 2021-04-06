import * as express from 'express'
import { body } from 'express-validator'
import { isAvatarFile } from '../../helpers/custom-validators/users'
import { areValidationErrors } from './utils'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { cleanUpReqFiles } from '../../helpers/express-utils'

const updateActorImageValidatorFactory = (fieldname: string) => ([
  body(fieldname).custom((value, { req }) => isAvatarFile(req.files)).withMessage(
    'This file is not supported or too large. Please, make sure it is of the following type : ' +
    CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME.join(', ')
  ),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateActorImageValidator parameters', { files: req.files })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const updateAvatarValidator = updateActorImageValidatorFactory('avatarfile')
const updateBannerValidator = updateActorImageValidatorFactory('bannerfile')

export {
  updateAvatarValidator,
  updateBannerValidator
}
