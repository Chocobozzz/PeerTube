import express from 'express'
import { body, param, query } from 'express-validator'
import { arrayify } from '@shared/core-utils'
import { FollowState } from '@shared/models'
import { HttpStatusCode } from '../../../shared/models/http/http-error-codes'
import { areValidActorHandles, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { WEBSERVER } from '../../initializers/constants'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { areValidationErrors } from './shared'

const userSubscriptionListValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userSubscriptionAddValidator = [
  body('uri')
    .custom(isValidActorHandle).withMessage('Should have a valid URI to follow (username@domain)'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const areSubscriptionsExistValidator = [
  query('uris')
    .customSanitizer(arrayify)
    .custom(areValidActorHandles).withMessage('Should have a valid array of URIs'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const userSubscriptionGetValidator = [
  param('uri')
    .custom(isValidActorHandle),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesSubscriptionExist({ uri: req.params.uri, res, state: 'accepted' })) return

    return next()
  }
]

const userSubscriptionDeleteValidator = [
  param('uri')
    .custom(isValidActorHandle),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesSubscriptionExist({ uri: req.params.uri, res })) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  areSubscriptionsExistValidator,
  userSubscriptionListValidator,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator,
  userSubscriptionDeleteValidator
}

// ---------------------------------------------------------------------------

async function doesSubscriptionExist (options: {
  uri: string
  res: express.Response
  state?: FollowState
}) {
  const { uri, res, state } = options

  let [ name, host ] = uri.split('@')
  if (host === WEBSERVER.HOST) host = null

  const user = res.locals.oauth.token.User
  const subscription = await ActorFollowModel.loadByActorAndTargetNameAndHostForAPI({
    actorId: user.Account.Actor.id,
    targetName: name,
    targetHost: host,
    state
  })

  if (!subscription?.ActorFollowing.VideoChannel) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: `Subscription ${uri} not found.`
    })
    return false
  }

  res.locals.subscription = subscription

  return true
}
