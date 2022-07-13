import express from 'express'
import { query } from 'express-validator'
import { logger } from '@server/helpers/logger'
import { SORTABLE_COLUMNS } from '../../initializers/constants'
import { areValidationErrors } from './shared'

function checkSortFactory (columns: string[], tags: string[] = []) {
  return checkSort(createSortableColumns(columns), tags)
}

function checkSort (sortableColumns: string[], tags: string[] = []) {
  return [
    query('sort').optional().isIn(sortableColumns).withMessage('Should have correct sortable column'),

    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking sort parameters', { parameters: req.query, tags })

      if (areValidationErrors(req, res)) return

      return next()
    }
  ]
}

function createSortableColumns (sortableColumns: string[]) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
}

const adminUsersSortValidator = checkSortFactory(SORTABLE_COLUMNS.ADMIN_USERS)
const accountsSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNTS)
const jobsSortValidator = checkSortFactory(SORTABLE_COLUMNS.JOBS, [ 'jobs' ])
const abusesSortValidator = checkSortFactory(SORTABLE_COLUMNS.ABUSES)
const videosSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEOS)
const videoImportsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_IMPORTS)
const videosSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEOS_SEARCH)
const videoChannelsSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNELS_SEARCH)
const videoPlaylistsSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_PLAYLISTS_SEARCH)
const videoCommentsValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_COMMENTS)
const videoCommentThreadsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_COMMENT_THREADS)
const videoRatesSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_RATES)
const blacklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.BLACKLISTS)
const videoChannelsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNELS)
const instanceFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.INSTANCE_FOLLOWERS)
const instanceFollowingSortValidator = checkSortFactory(SORTABLE_COLUMNS.INSTANCE_FOLLOWING)
const userSubscriptionsSortValidator = checkSortFactory(SORTABLE_COLUMNS.USER_SUBSCRIPTIONS)
const accountsBlocklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNTS_BLOCKLIST)
const serversBlocklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.SERVERS_BLOCKLIST)
const userNotificationsSortValidator = checkSortFactory(SORTABLE_COLUMNS.USER_NOTIFICATIONS)
const videoPlaylistsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_PLAYLISTS)
const pluginsSortValidator = checkSortFactory(SORTABLE_COLUMNS.PLUGINS)
const availablePluginsSortValidator = checkSortFactory(SORTABLE_COLUMNS.AVAILABLE_PLUGINS)
const videoRedundanciesSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_REDUNDANCIES)
const videoChannelSyncsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNEL_SYNCS)

const accountsFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNT_FOLLOWERS)
const videoChannelsFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.CHANNEL_FOLLOWERS)

// ---------------------------------------------------------------------------

export {
  adminUsersSortValidator,
  abusesSortValidator,
  videoChannelsSortValidator,
  videoImportsSortValidator,
  videoCommentsValidator,
  videosSearchSortValidator,
  videosSortValidator,
  blacklistSortValidator,
  accountsSortValidator,
  instanceFollowersSortValidator,
  instanceFollowingSortValidator,
  jobsSortValidator,
  videoCommentThreadsSortValidator,
  videoRatesSortValidator,
  userSubscriptionsSortValidator,
  availablePluginsSortValidator,
  videoChannelsSearchSortValidator,
  accountsBlocklistSortValidator,
  serversBlocklistSortValidator,
  userNotificationsSortValidator,
  videoPlaylistsSortValidator,
  videoRedundanciesSortValidator,
  videoPlaylistsSearchSortValidator,
  accountsFollowersSortValidator,
  videoChannelsFollowersSortValidator,
  videoChannelSyncsSortValidator,
  pluginsSortValidator
}
