import { isActorImageFile } from '@server/helpers/custom-validators/actor-images.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import express from 'express'
import { body } from 'express-validator'
import { areValidationErrors } from './utils.js'

export const updateActorImageValidatorFactory = (fieldname: string) => [
  body(fieldname).custom((value, { req }) => isActorImageFile(req.files, fieldname)).withMessage(
    'This file is not supported or too large. Please, make sure it is of the following type : ' +
      CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME.join(', ')
  ),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    return next()
  }
]
