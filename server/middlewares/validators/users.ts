import { body, param } from 'express-validator/check'
import 'express-validator'
import * as express from 'express'
import * as Promise from 'bluebird'
import * as validator from 'validator'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import {
  isSignupAllowed,
  logger,
  isUserUsernameValid,
  isUserPasswordValid,
  isUserVideoQuotaValid,
  isUserDisplayNSFWValid,
  isIdOrUUIDValid,
  isUserRoleValid
} from '../../helpers'
import { UserInstance, VideoInstance } from '../../models'

const usersAddValidator = [
  body('username').custom(isUserUsernameValid).withMessage('Should have a valid username (lowercase alphanumeric characters)'),
  body('password').custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email').isEmail().withMessage('Should have a valid email'),
  body('videoQuota').custom(isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
  body('role').custom(isUserRoleValid).withMessage('Should have a valid role'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersAdd parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkUserDoesNotAlreadyExist(req.body.username, req.body.email, res, next)
    })
  }
]

const usersRegisterValidator = [
  body('username').custom(isUserUsernameValid).withMessage('Should have a valid username'),
  body('password').custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email').isEmail().withMessage('Should have a valid email'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersRegister parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkUserDoesNotAlreadyExist(req.body.username, req.body.email, res, next)
    })
  }
]

const usersRemoveValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersRemove parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkUserExists(req.params.id, res, (err, user) => {
        if (err) {
          logger.error('Error in usersRemoveValidator.', err)
          return res.sendStatus(500)
        }

        if (user.username === 'root') {
          return res.status(400)
                    .send({ error: 'Cannot remove the root user' })
                    .end()
        }

        return next()
      })
    })
  }
]

const usersUpdateValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
  body('email').optional().isEmail().withMessage('Should have a valid email attribute'),
  body('videoQuota').optional().custom(isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
  body('role').optional().custom(isUserRoleValid).withMessage('Should have a valid role'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersUpdate parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkUserExists(req.params.id, res, next)
    })
  }
]

const usersUpdateMeValidator = [
  body('password').optional().custom(isUserPasswordValid).withMessage('Should have a valid password'),
  body('email').optional().isEmail().withMessage('Should have a valid email attribute'),
  body('displayNSFW').optional().custom(isUserDisplayNSFWValid).withMessage('Should have a valid display Not Safe For Work attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // TODO: Add old password verification
    logger.debug('Checking usersUpdateMe parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

const usersGetValidator = [
  param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    checkErrors(req, res, () => {
      checkUserExists(req.params.id, res, next)
    })
  }
]

const usersVideoRatingValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking usersVideoRating parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      let videoPromise: Promise<VideoInstance>

      if (validator.isUUID(req.params.videoId)) {
        videoPromise = db.Video.loadByUUID(req.params.videoId)
      } else {
        videoPromise = db.Video.load(req.params.videoId)
      }

      videoPromise
        .then(video => {
          if (!video) {
            return res.status(404)
                      .json({ error: 'Video not found' })
                      .end()
          }

          return next()
        })
        .catch(err => {
          logger.error('Error in user request validator.', err)
          return res.sendStatus(500)
        })
    })
  }
]

const ensureUserRegistrationAllowed = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    isSignupAllowed().then(allowed => {
      if (allowed === false) {
        return res.status(403)
                  .send({ error: 'User registration is not enabled or user limit is reached.' })
                  .end()
      }

      return next()
    })
  }
]

// ---------------------------------------------------------------------------

export {
  usersAddValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersUpdateValidator,
  usersUpdateMeValidator,
  usersVideoRatingValidator,
  ensureUserRegistrationAllowed,
  usersGetValidator
}

// ---------------------------------------------------------------------------

function checkUserExists (id: number, res: express.Response, callback: (err: Error, user: UserInstance) => void) {
  db.User.loadById(id)
    .then(user => {
      if (!user) {
        return res.status(404)
                  .send({ error: 'User not found' })
                  .end()
      }

      res.locals.user = user
      return callback(null, user)
    })
    .catch(err => {
      logger.error('Error in user request validator.', err)
      return res.sendStatus(500)
    })
}

function checkUserDoesNotAlreadyExist (username: string, email: string, res: express.Response, callback: () => void) {
  db.User.loadByUsernameOrEmail(username, email)
      .then(user => {
        if (user) {
          return res.status(409)
                    .send({ error: 'User with this username of email already exists.' })
                    .end()
        }

        return callback()
      })
      .catch(err => {
        logger.error('Error in usersAdd request validator.', err)
        return res.sendStatus(500)
      })
}
