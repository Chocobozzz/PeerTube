'use strict'

const checkErrors = require('./utils').checkErrors
const constants = require('../../initializers/constants')
const logger = require('../../helpers/logger')

const reqValidatorsSort = {
  videosSort: videosSort
}

function videosSort (req, res, next) {
  const sortableColumns = constants.SORTABLE_COLUMNS.VIDEOS

  req.checkQuery('sort', 'Should have correct sortable column').optional().isIn(sortableColumns)

  logger.debug('Checking sort parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = reqValidatorsSort
