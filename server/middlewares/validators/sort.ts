import { query } from 'express-validator/check'
import * as express from 'express'

import { checkErrors } from './utils'
import { logger } from '../../helpers'
import { SORTABLE_COLUMNS } from '../../initializers'

// Initialize constants here for better performances
const SORTABLE_PODS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.PODS)
const SORTABLE_USERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USERS)
const SORTABLE_VIDEO_ABUSES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_ABUSES)
const SORTABLE_VIDEOS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS)
const SORTABLE_BLACKLISTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.BLACKLISTS)
const SORTABLE_VIDEO_CHANNELS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_CHANNELS)

const podsSortValidator = checkSort(SORTABLE_PODS_COLUMNS)
const usersSortValidator = checkSort(SORTABLE_USERS_COLUMNS)
const videoAbusesSortValidator = checkSort(SORTABLE_VIDEO_ABUSES_COLUMNS)
const videosSortValidator = checkSort(SORTABLE_VIDEOS_COLUMNS)
const blacklistSortValidator = checkSort(SORTABLE_BLACKLISTS_COLUMNS)
const videoChannelsSortValidator = checkSort(SORTABLE_VIDEO_CHANNELS_COLUMNS)

// ---------------------------------------------------------------------------

export {
  podsSortValidator,
  usersSortValidator,
  videoAbusesSortValidator,
  videoChannelsSortValidator,
  videosSortValidator,
  blacklistSortValidator
}

// ---------------------------------------------------------------------------

function checkSort (sortableColumns: string[]) {
  return [
    query('sort').optional().isIn(sortableColumns).withMessage('Should have correct sortable column'),

    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking sort parameters', { parameters: req.query })

      checkErrors(req, res, next)
    }
  ]
}

function createSortableColumns (sortableColumns: string[]) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
}
