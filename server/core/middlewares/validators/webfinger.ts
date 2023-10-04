import express from 'express'
import { query } from 'express-validator'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isWebfingerLocalResourceValid } from '../../helpers/custom-validators/webfinger.js'
import { getHostWithPort } from '../../helpers/express-utils.js'
import { ActorModel } from '../../models/actor/actor.js'
import { areValidationErrors } from './shared/index.js'

const webfingerValidator = [
  query('resource')
    .custom(isWebfingerLocalResourceValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    // Remove 'acct:' from the beginning of the string
    const nameWithHost = getHostWithPort(req.query.resource.substr(5))
    const [ name ] = nameWithHost.split('@')

    const actor = await ActorModel.loadLocalUrlByName(name)
    if (!actor) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Actor not found'
      })
    }

    res.locals.actorUrl = actor
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  webfingerValidator
}
