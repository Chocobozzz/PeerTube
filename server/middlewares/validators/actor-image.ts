import * as express from 'express'
import { body } from 'express-validator'
import { checkActorImageFile } from '@server/helpers/custom-validators/actor-images'
import { cleanUpReqFiles } from '../../helpers/express-utils'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const updateActorImageValidatorFactory = (fieldname: string) => ([
  body(fieldname)
    .custom((value, { req }) => checkActorImageFile(req.files, fieldname)),

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
