import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode } from '../../../shared/models/http/http-error-codes'
import { areValidActorHandles, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { toArray } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { WEBSERVER } from '../../initializers/constants'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { areValidationErrors } from './shared'

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
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: `Subscription ${req.params.uri} not found.`
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
