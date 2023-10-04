import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode, ServerFollowCreate } from '@peertube/peertube-models'
import { isProdInstance } from '@peertube/peertube-node-utils'
import { isEachUniqueHandleValid, isFollowStateValid, isRemoteHandleValid } from '@server/helpers/custom-validators/follows.js'
import { loadActorUrlOrGetFromWebfinger } from '@server/lib/activitypub/actors/index.js'
import { getRemoteNameAndHost } from '@server/lib/activitypub/follow.js'
import { getServerActor } from '@server/models/application/application.js'
import { MActorFollowActorsDefault } from '@server/types/models/index.js'
import { isActorTypeValid, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor.js'
import { isEachUniqueHostValid, isHostValid } from '../../helpers/custom-validators/servers.js'
import { logger } from '../../helpers/logger.js'
import { WEBSERVER } from '../../initializers/constants.js'
import { ActorFollowModel } from '../../models/actor/actor-follow.js'
import { ActorModel } from '../../models/actor/actor.js'
import { areValidationErrors } from './shared/index.js'

const listFollowsValidator = [
  query('state')
    .optional()
    .custom(isFollowStateValid),
  query('actorType')
    .optional()
    .custom(isActorTypeValid),

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
    .custom(value => isHostValid(value) || isRemoteHandleValid(value)),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  param('nameWithHost')
    .custom(isValidActorHandle),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    const follow = res.locals.follow
    if (follow.state !== 'pending' && follow.state !== 'rejected') {
      return res.fail({ message: 'Follow is not in pending/rejected state.' })
    }

    return next()
  }
]

const rejectFollowerValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
