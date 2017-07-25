import 'express-validator'
import * as express from 'express'
import * as Promise from 'bluebird'
import * as validator from 'validator'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { isSignupAllowed, logger } from '../../helpers'
import { VideoInstance } from '../../models'

function usersAddValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email').isEmail()

  logger.debug('Checking usersAdd parameters', { parameters: req.body })

  checkErrors(req, res, () => {
    db.User.loadByUsernameOrEmail(req.body.username, req.body.email)
      .then(user => {
        if (user) return res.status(409).send('User already exists.')

        next()
      })
      .catch(err => {
        logger.error('Error in usersAdd request validator.', err)
        return res.sendStatus(500)
      })
  })
}

function usersRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()

  logger.debug('Checking usersRemove parameters', { parameters: req.params })

  checkErrors(req, res, () => {
    db.User.loadById(req.params.id)
      .then(user => {
        if (!user) return res.status(404).send('User not found')

        if (user.username === 'root') return res.status(400).send('Cannot remove the root user')

        next()
      })
      .catch(err => {
        logger.error('Error in usersRemove request validator.', err)
        return res.sendStatus(500)
      })
  })
}

function usersUpdateValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()
  // Add old password verification
  req.checkBody('password', 'Should have a valid password').optional().isUserPasswordValid()
  req.checkBody('displayNSFW', 'Should have a valid display Not Safe For Work attribute').optional().isUserDisplayNSFWValid()

  logger.debug('Checking usersUpdate parameters', { parameters: req.body })

  checkErrors(req, res, next)
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
  usersRemoveValidator,
  usersUpdateValidator,
  usersVideoRatingValidator,
  ensureUserRegistrationAllowed
}
