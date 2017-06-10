import 'express-validator'
import * as express from 'express'

import { checkErrors } from './utils'
import { logger } from '../../helpers'
import { SORTABLE_COLUMNS } from '../../initializers'

// Initialize constants here for better performances
const SORTABLE_USERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USERS)
const SORTABLE_VIDEO_ABUSES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_ABUSES)
const SORTABLE_VIDEOS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS)

function usersSortValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  checkSort(req, res, next, SORTABLE_USERS_COLUMNS)
}

function videoAbusesSortValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  checkSort(req, res, next, SORTABLE_VIDEO_ABUSES_COLUMNS)
}

function videosSortValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  checkSort(req, res, next, SORTABLE_VIDEOS_COLUMNS)
}

// ---------------------------------------------------------------------------

export {
  usersSortValidator,
  videoAbusesSortValidator,
  videosSortValidator
}

// ---------------------------------------------------------------------------

function checkSort (req: express.Request, res: express.Response, next: express.NextFunction, sortableColumns: string[]) {
  req.checkQuery('sort', 'Should have correct sortable column').optional().isIn(sortableColumns)

  logger.debug('Checking sort parameters', { parameters: req.query })

  checkErrors(req, res, next)
}

function createSortableColumns (sortableColumns: string[]) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
}
