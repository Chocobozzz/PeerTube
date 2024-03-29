import express from 'express'
import { query } from 'express-validator'
import { SORTABLE_COLUMNS } from '../../initializers/constants.js'
import { areValidationErrors } from './shared/index.js'

export const adminUsersSortValidator = checkSortFactory(SORTABLE_COLUMNS.ADMIN_USERS)
export const accountsSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNTS)
export const jobsSortValidator = checkSortFactory(SORTABLE_COLUMNS.JOBS, [ 'jobs' ])
export const abusesSortValidator = checkSortFactory(SORTABLE_COLUMNS.ABUSES)
export const videosSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEOS)
export const videoImportsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_IMPORTS)
export const videosSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEOS_SEARCH)
export const videoChannelsSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNELS_SEARCH)
export const videoPlaylistsSearchSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_PLAYLISTS_SEARCH)
export const videoCommentsValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_COMMENTS)
export const videoCommentThreadsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_COMMENT_THREADS)
export const videoRatesSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_RATES)
export const blacklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.BLACKLISTS)
export const videoChannelsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNELS)
export const instanceFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.INSTANCE_FOLLOWERS)
export const instanceFollowingSortValidator = checkSortFactory(SORTABLE_COLUMNS.INSTANCE_FOLLOWING)
export const userSubscriptionsSortValidator = checkSortFactory(SORTABLE_COLUMNS.USER_SUBSCRIPTIONS)
export const accountsBlocklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNTS_BLOCKLIST)
export const serversBlocklistSortValidator = checkSortFactory(SORTABLE_COLUMNS.SERVERS_BLOCKLIST)
export const userNotificationsSortValidator = checkSortFactory(SORTABLE_COLUMNS.USER_NOTIFICATIONS)
export const videoPlaylistsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_PLAYLISTS)
export const pluginsSortValidator = checkSortFactory(SORTABLE_COLUMNS.PLUGINS)
export const availablePluginsSortValidator = checkSortFactory(SORTABLE_COLUMNS.AVAILABLE_PLUGINS)
export const videoRedundanciesSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_REDUNDANCIES)
export const videoChannelSyncsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_CHANNEL_SYNCS)
export const videoPasswordsSortValidator = checkSortFactory(SORTABLE_COLUMNS.VIDEO_PASSWORDS)

export const watchedWordsListsSortValidator = checkSortFactory(SORTABLE_COLUMNS.WATCHED_WORDS_LISTS)

export const accountsFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.ACCOUNT_FOLLOWERS)
export const videoChannelsFollowersSortValidator = checkSortFactory(SORTABLE_COLUMNS.CHANNEL_FOLLOWERS)

export const userRegistrationsSortValidator = checkSortFactory(SORTABLE_COLUMNS.USER_REGISTRATIONS)

export const runnersSortValidator = checkSortFactory(SORTABLE_COLUMNS.RUNNERS)
export const runnerRegistrationTokensSortValidator = checkSortFactory(SORTABLE_COLUMNS.RUNNER_REGISTRATION_TOKENS)
export const runnerJobsSortValidator = checkSortFactory(SORTABLE_COLUMNS.RUNNER_JOBS)

// ---------------------------------------------------------------------------

function checkSortFactory (columns: string[], tags: string[] = []) {
  return checkSort(createSortableColumns(columns), tags)
}

function checkSort (sortableColumns: string[], tags: string[] = []) {
  return [
    query('sort')
      .optional()
      .isIn(sortableColumns),

    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res, { tags })) return

      return next()
    }
  ]
}

function createSortableColumns (sortableColumns: string[]) {
  const sortableColumnDesc = sortableColumns.map(sortableColumn => '-' + sortableColumn)

  return sortableColumns.concat(sortableColumnDesc)
}
