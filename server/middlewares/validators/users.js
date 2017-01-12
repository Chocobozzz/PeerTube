'use strict'

const checkErrors = require('./utils').checkErrors
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')

const validatorsUsers = {
  usersAdd,
  usersRemove,
  usersUpdate
}

function usersAdd (req, res, next) {
  req.checkBody('username', 'Should have a valid username').isUserUsernameValid()
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()

  logger.debug('Checking usersAdd parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    db.User.loadByUsername(req.body.username, function (err, user) {
      if (err) {
        logger.error('Error in usersAdd request validator.', { error: err })
        return res.sendStatus(500)
      }

      if (user) return res.status(409).send('User already exists.')

      next()
    })
  })
}

function usersRemove (req, res, next) {
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

function usersUpdate (req, res, next) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isInt()
  // Add old password verification
  req.checkBody('password', 'Should have a valid password').isUserPasswordValid()

  logger.debug('Checking usersUpdate parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsUsers
