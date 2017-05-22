import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'

function usersAddValidator (req, res, next) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()
  req.checkBody('email', 'Should have a valid email').isEmail()

  logger.debug('Checking usersAdd parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    db.User.loadByUsernameOrEmail(req.body.username, req.body.email, function (err, user) {
      if (err) {
        logger.error('Error in usersAdd request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (user) return res.status(409).send('User already exists.')

      next()
    })
  })
}

function usersRemoveValidator (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()

  logger.debug('Checking usersRemove parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    db.User.loadById(req.params.id, function (err, user) {
      if (err) {
        logger.error('Error in usersRemove request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (!user) return res.status(404).send('User not found')

      if (user.username === 'root') return res.status(400).send('Cannot remove the root user')

      next()
    })
  })
}

function usersUpdateValidator (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()
  // Add old password verification
  req.checkBody('password', 'Should have a valid password').optional().isUserPasswordValid()
  req.checkBody('displayNSFW', 'Should have a valid display Not Safe For Work attribute').optional().isUserDisplayNSFWValid()

  logger.debug('Checking usersUpdate parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function usersVideoRatingValidator (req, res, next) {
  req.checkParams('videoId', 'Should have a valid video id').notEmpty().isUUID(4)

  logger.debug('Checking usersVideoRating parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    db.Video.load(req.params.videoId, function (err, video) {
      if (err) {
        logger.error('Error in user request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (!video) return res.status(404).send('Video not found')

      next()
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
