import express from 'express'
import { body, param, query } from 'express-validator'
import { isProdInstance } from '@server/helpers/core-utils'
import { isEachUniqueHandleValid, isFollowStateValid, isRemoteHandleValid } from '@server/helpers/custom-validators/follows'
import { loadActorUrlOrGetFromWebfinger } from '@server/lib/activitypub/actors'
import { getRemoteNameAndHost } from '@server/lib/activitypub/follow'
import { getServerActor } from '@server/models/application/application'
import { MActorFollowActorsDefault } from '@server/types/models'
import { ServerFollowCreate } from '@shared/models'
import { HttpStatusCode } from '../../../shared/models/http/http-error-codes'
import { isActorTypeValid, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { isEachUniqueHostValid, isHostValid } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { WEBSERVER } from '../../initializers/constants'
import { ActorModel } from '../../models/actor/actor'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { areValidationErrors } from './shared'

const listFollowsValidator = [
  query('state')
    .optional()
    .custom(isFollowStateValid).withMessage('Should have a valid follow state'),
  query('actorType')
    .optional()
    .custom(isActorTypeValid).withMessage('Should have a valid actor type'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const followValidator = [
  body('hosts')
    .toArray()
    .custom(isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),

  body('handles')
    .toArray()
    .custom(isEachUniqueHandleValid).withMessage('Should have an array of handles'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Force https if the administrator wants to follow remote actors
    if (isProdInstance() && WEBSERVER.SCHEME === 'http') {
      return res
        .status(HttpStatusCode.INTERNAL_SERVER_ERROR_500)
        .json({
          error: 'Cannot follow on a non HTTPS web server.'
        })
    }

    logger.debug('Checking follow parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const body: ServerFollowCreate = req.body
    if (body.hosts.length === 0 && body.handles.length === 0) {

      return res
        .status(HttpStatusCode.BAD_REQUEST_400)
        .json({
          error: 'You must provide at least one handle or one host.'
        })
    }

    return next()
  }
]

const removeFollowingValidator = [
  param('hostOrHandle')
    .custom(value => isHostValid(value) || isRemoteHandleValid(value))
    .withMessage('Should have a valid host/handle'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unfollowing parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const serverActor = await getServerActor()

    const { name, host } = getRemoteNameAndHost(req.params.hostOrHandle)
    const follow = await ActorFollowModel.loadByActorAndTargetNameAndHostForAPI({
      actorId: serverActor.id,
      targetName: name,
      targetHost: host
    })

    if (!follow) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: `Follow ${req.params.hostOrHandle} not found.`
      })
    }

    res.locals.follow = follow
    return next()
  }
]

const getFollowerValidator = [
  param('nameWithHost').custom(isValidActorHandle).withMessage('Should have a valid nameWithHost'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking get follower parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    let follow: MActorFollowActorsDefault
    try {
      const actorUrl = await loadActorUrlOrGetFromWebfinger(req.params.nameWithHost)
      const actor = await ActorModel.loadByUrl(actorUrl)

      const serverActor = await getServerActor()
      follow = await ActorFollowModel.loadByActorAndTarget(actor.id, serverActor.id)
    } catch (err) {
      logger.warn('Cannot get actor from handle.', { handle: req.params.nameWithHost, err })
    }

    if (!follow) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: `Follower ${req.params.nameWithHost} not found.`
      })
    }

    res.locals.follow = follow
    return next()
  }
]

const acceptFollowerValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accept follower parameters', { parameters: req.params })

    const follow = res.locals.follow
    if (follow.state !== 'pending' && follow.state !== 'rejected') {
      return res.fail({ message: 'Follow is not in pending/rejected state.' })
    }

    return next()
  }
]

const rejectFollowerValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking reject follower parameters', { parameters: req.params })

    const follow = res.locals.follow
    if (follow.state !== 'pending' && follow.state !== 'accepted') {
      return res.fail({ message: 'Follow is not in pending/accepted state.' })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  followValidator,
  removeFollowingValidator,
  getFollowerValidator,
  acceptFollowerValidator,
  rejectFollowerValidator,
  listFollowsValidator
}
