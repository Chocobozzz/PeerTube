import 'express-validator'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'

function usersAddValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email').isEmail()

  logger.debug('Checking usersAdd parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    db.User.loadByUsernameOrEmail(req.body.username, req.body.email)
      .then(user => {
        if (user) return res.status(409).send('User already exists.')

        next()
      })
      .catch(err => {
        logger.error('Error in usersAdd request validator.', { error: err })
        return res.sendStatus(500)
      })
  })
}

function usersRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()

  logger.debug('Checking usersRemove parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    db.User.loadById(req.params.id)
      .then(user => {
        if (!user) return res.status(404).send('User not found')

        if (user.username === 'root') return res.status(400).send('Cannot remove the root user')

        next()
      })
      .catch(err => {
        logger.error('Error in usersRemove request validator.', { error: err })
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
  req.checkParams('videoId', 'Should have a valid video id').notEmpty().isUUID(4)

  logger.debug('Checking usersVideoRating parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    db.Video.load(req.params.videoId)
      .then(video => {
        if (!video) return res.status(404).send('Video not found')

        next()
      })
      .catch(err => {
        logger.error('Error in user request validator.', { error: err })
        return res.sendStatus(500)
      })
  })
}

// ---------------------------------------------------------------------------

export {
  usersAddValidator,
  usersRemoveValidator,
  usersUpdateValidator,
  usersVideoRatingValidator
}
