'use strict'

const checkErrors = require('./utils').checkErrors
const constants = require('../../initializers/constants')
const logger = require('../../helpers/logger')

const validatorsSort = {
  usersSort,
  videoAbusesSort,
  videosSort
}

function usersSort (req, res, next) {
  const sortableColumns = constants.SORTABLE_COLUMNS.USERS

  checkSort(req, res, next, sortableColumns)
}

function videoAbusesSort (req, res, next) {
  const sortableColumns = constants.SORTABLE_COLUMNS.VIDEO_ABUSES

  checkSort(req, res, next, sortableColumns)
}

function videosSort (req, res, next) {
  const sortableColumns = constants.SORTABLE_COLUMNS.VIDEOS

  checkSort(req, res, next, sortableColumns)
}

// ---------------------------------------------------------------------------

module.exports = validatorsSort

// ---------------------------------------------------------------------------

function checkSort (req, res, next, sortableColumns) {
  req.checkQuery('sort', 'Should have correct sortable column').optional().isIn(sortableColumns)

  logger.debug('Checking sort parameters', { parameters: req.query })

  checkErrors(req, res, next)
}
