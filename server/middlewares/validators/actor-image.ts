import * as express from 'express'
import { body } from 'express-validator'
import { isActorImageFile } from '@server/helpers/custom-validators/actor-images'
import { cleanUpReqFiles } from '../../helpers/express-utils'
import { logger } from '../../helpers/logger'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { areValidationErrors } from './shared'

const updateActorImageValidatorFactory = (fieldname: string) => ([
  body(fieldname).custom((value, { req }) => isActorImageFile(req.files, fieldname)).withMessage(
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
