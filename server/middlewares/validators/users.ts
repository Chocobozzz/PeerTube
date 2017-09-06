import 'express-validator'
import * as express from 'express'
import * as Promise from 'bluebird'
import * as validator from 'validator'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { isSignupAllowed, logger } from '../../helpers'
import { UserInstance, VideoInstance } from '../../models'

function usersAddValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email').isEmail()
  req.checkBody('videoQuota', 'Should have a valid user quota').isUserVideoQuotaValid()

  logger.debug('Checking usersAdd parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkUserDoesNotAlreadyExist(req.body.username, req.body.email, res, next)
  })
}

function usersRegisterValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email').isEmail()

  logger.debug('Checking usersRegister parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkUserDoesNotAlreadyExist(req.body.username, req.body.email, res, next)
  })
}

function usersRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()

  logger.debug('Checking usersRemove parameters', { parameters: req.params })

  checkErrors(req, res, () => {
    checkUserExists(req.params.id, res, (err, user) => {
      if (err) {
        logger.error('Error in usersRemoveValidator.', err)
        return res.sendStatus(500)
      }

      if (user.username === 'root') return res.status(400).send('Cannot remove the root user')

      next()
    })
  })
}

function usersUpdateValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()
  req.checkBody('email', 'Should have a valid email attribute').optional().isEmail()
  req.checkBody('videoQuota', 'Should have a valid user quota').optional().isUserVideoQuotaValid()

  logger.debug('Checking usersUpdate parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    checkUserExists(req.params.id, res, next)
  })
}

function usersUpdateMeValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  // Add old password verification
  req.checkBody('password', 'Should have a valid password').optional().isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email attribute').optional().isEmail()
  req.checkBody('displayNSFW', 'Should have a valid display Not Safe For Work attribute').optional().isUserDisplayNSFWValid()

  logger.debug('Checking usersUpdateMe parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function usersGetValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()

  checkErrors(req, res, () => {
    checkUserExists(req.params.id, res, next)
  })
}

function usersVideoRatingValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('videoId', 'Should have a valid video id').notEmpty().isVideoIdOrUUIDValid()

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
        if (!video) return res.status(404).send('Video not found')

        next()
      })
      .catch(err => {
        logger.error('Error in user request validator.', err)
        return res.sendStatus(500)
      })
  })
}

function ensureUserRegistrationAllowed (req: express.Request, res: express.Response, next: express.NextFunction) {
  isSignupAllowed().then(allowed => {
    if (allowed === false) {
      return res.status(403).send('User registration is not enabled or user limit is reached.')
    }

    return next()
  })
}

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
      if (!user) return res.status(404).send('User not found')

      res.locals.user = user
      callback(null, user)
    })
    .catch(err => {
      logger.error('Error in user request validator.', err)
      return res.sendStatus(500)
    })
}

function checkUserDoesNotAlreadyExist (username: string, email: string, res: express.Response, callback: () => void) {
  db.User.loadByUsernameOrEmail(username, email)
      .then(user => {
        if (user) return res.status(409).send('User already exists.')

        callback()
      })
      .catch(err => {
        logger.error('Error in usersAdd request validator.', err)
        return res.sendStatus(500)
      })
}
