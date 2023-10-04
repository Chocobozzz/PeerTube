import express from 'express'
import { param } from 'express-validator'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { RunnerRegistrationTokenModel } from '@server/models/runner/runner-registration-token.js'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { areValidationErrors } from '../shared/utils.js'

const tags = [ 'runner' ]

const deleteRegistrationTokenValidator = [
  param('id').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res, { tags })) return

    const registrationToken = await RunnerRegistrationTokenModel.load(forceNumber(req.params.id))

    if (!registrationToken) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Registration token not found',
        tags
      })
    }

    res.locals.runnerRegistrationToken = registrationToken

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  deleteRegistrationTokenValidator
}
