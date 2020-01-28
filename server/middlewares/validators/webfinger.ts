import * as express from 'express'
import { query } from 'express-validator'
import { isWebfingerLocalResourceValid } from '../../helpers/custom-validators/webfinger'
import { logger } from '../../helpers/logger'
import { ActorModel } from '../../models/activitypub/actor'
import { areValidationErrors } from './utils'
import { getHostWithPort } from '../../helpers/express-utils'

const webfingerValidator = [
  query('resource').custom(isWebfingerLocalResourceValid).withMessage('Should have a valid webfinger resource'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking webfinger parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    // Remove 'acct:' from the beginning of the string
    const nameWithHost = getHostWithPort(req.query.resource.substr(5))
    const [ name ] = nameWithHost.split('@')

    const actor = await ActorModel.loadLocalUrlByName(name)
    if (!actor) {
      return res.status(404)
        .send({ error: 'Actor not found' })
        .end()
    }

    res.locals.actorUrl = actor
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  webfingerValidator
}
