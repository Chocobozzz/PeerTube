import * as express from 'express'
import { body, param, query } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { areValidActorHandles, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { toArray } from '../../helpers/custom-validators/misc'
import { WEBSERVER } from '../../initializers/constants'

const userSubscriptionListValidator = [
  query('search').optional().not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userSubscriptionListValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userSubscriptionAddValidator = [
  body('uri').custom(isValidActorHandle).withMessage('Should have a valid URI to follow (username@domain)'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userSubscriptionAddValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const areSubscriptionsExistValidator = [
  query('uris')
    .customSanitizer(toArray)
    .custom(areValidActorHandles).withMessage('Should have a valid uri array'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking areSubscriptionsExistValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userSubscriptionGetValidator = [
  param('uri').custom(isValidActorHandle).withMessage('Should have a valid URI to unfollow'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking userSubscriptionGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    let [ name, host ] = req.params.uri.split('@')
    if (host === WEBSERVER.HOST) host = null

    const user = res.locals.oauth.token.User
    const subscription = await ActorFollowModel.loadByActorAndTargetNameAndHostForAPI(user.Account.Actor.id, name, host)

    if (!subscription || !subscription.ActorFollowing.VideoChannel) {
      return res
        .status(404)
        .json({
          error: `Subscription ${req.params.uri} not found.`
        })
    }

    res.locals.subscription = subscription
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  areSubscriptionsExistValidator,
  userSubscriptionListValidator,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator
}
