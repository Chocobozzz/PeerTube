'use strict'

const checkErrors = require('./utils').checkErrors
const logger = require('../../helpers/logger')

const reqValidatorsPagination = {
  pagination: pagination
}

function pagination (req, res, next) {
  req.checkParams('start', 'Should have a number start').optional().isInt()
  req.checkParams('count', 'Should have a number count').optional().isInt()

  logger.debug('Checking pagination parameters', { parameters: req.params })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = reqValidatorsPagination
