'use strict'

const checkErrors = require('./utils').checkErrors
const constants = require('../../initializers/constants')
const logger = require('../../helpers/logger')

const validatorsSort = {
  usersSort,
  videoAbusesSort,
  videosSort
}

// Initialize constants here for better performances
const SORTABLE_USERS_COLUMNS = createSortableColumns(constants.SORTABLE_COLUMNS.USERS)
const SORTABLE_VIDEO_ABUSES_COLUMNS = createSortableColumns(constants.SORTABLE_COLUMNS.VIDEO_ABUSES)
const SORTABLE_VIDEOS_COLUMNS = createSortableColumns(constants.SORTABLE_COLUMNS.VIDEOS)

function usersSort (req, res, next) {
  checkSort(req, res, next, SORTABLE_USERS_COLUMNS)
}

function videoAbusesSort (req, res, next) {
  checkSort(req, res, next, SORTABLE_VIDEO_ABUSES_COLUMNS)
}

function videosSort (req, res, next) {
  checkSort(req, res, next, SORTABLE_VIDEOS_COLUMNS)
}

// ---------------------------------------------------------------------------

module.exports = validatorsSort

// ---------------------------------------------------------------------------

function checkSort (req, res, next, sortableColumns) {
  req.checkQuery('sort', 'Should have correct sortable column').optional().isIn(sortableColumns)

  logger.debug('Checking sort parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

function createSortableColumns (sortableColumns) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
}
