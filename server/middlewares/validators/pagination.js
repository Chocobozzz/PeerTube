'use strict'

const checkErrors = require('./utils').checkErrors
const logger = require('../../helpers/logger')

const validatorsPagination = {
  pagination: pagination
}

function pagination (req, res, next) {
  req.checkQuery('start', 'Should have a number start').optional().isInt()
  req.checkQuery('count', 'Should have a number count').optional().isInt()

  logger.debug('Checking pagination parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsPagination
