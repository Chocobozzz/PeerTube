import { SORTABLE_COLUMNS } from '../../initializers/constants'
import { checkSort, createSortableColumns } from './utils'

// Initialize constants here for better performances
const SORTABLE_USERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USERS)
const SORTABLE_ACCOUNTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.ACCOUNTS)
const SORTABLE_JOBS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.JOBS)
const SORTABLE_ABUSES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.ABUSES)
const SORTABLE_VIDEOS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS)
const SORTABLE_VIDEOS_SEARCH_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS_SEARCH)
const SORTABLE_VIDEO_CHANNELS_SEARCH_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_CHANNELS_SEARCH)
const SORTABLE_VIDEO_IMPORTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_IMPORTS)
const SORTABLE_VIDEO_COMMENT_THREADS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_COMMENT_THREADS)
const SORTABLE_VIDEO_RATES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_RATES)
const SORTABLE_BLACKLISTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.BLACKLISTS)
const SORTABLE_VIDEO_CHANNELS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_CHANNELS)
const SORTABLE_FOLLOWERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.FOLLOWERS)
const SORTABLE_FOLLOWING_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.FOLLOWING)
const SORTABLE_USER_SUBSCRIPTIONS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USER_SUBSCRIPTIONS)
const SORTABLE_ACCOUNTS_BLOCKLIST_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.ACCOUNTS_BLOCKLIST)
const SORTABLE_SERVERS_BLOCKLIST_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.SERVERS_BLOCKLIST)
const SORTABLE_USER_NOTIFICATIONS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USER_NOTIFICATIONS)
const SORTABLE_VIDEO_PLAYLISTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_PLAYLISTS)
const SORTABLE_PLUGINS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.PLUGINS)
const SORTABLE_AVAILABLE_PLUGINS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.AVAILABLE_PLUGINS)
const SORTABLE_VIDEO_REDUNDANCIES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_REDUNDANCIES)

const usersSortValidator = checkSort(SORTABLE_USERS_COLUMNS)
const accountsSortValidator = checkSort(SORTABLE_ACCOUNTS_COLUMNS)
const jobsSortValidator = checkSort(SORTABLE_JOBS_COLUMNS)
const abusesSortValidator = checkSort(SORTABLE_ABUSES_COLUMNS)
const videosSortValidator = checkSort(SORTABLE_VIDEOS_COLUMNS)
const videoImportsSortValidator = checkSort(SORTABLE_VIDEO_IMPORTS_COLUMNS)
const videosSearchSortValidator = checkSort(SORTABLE_VIDEOS_SEARCH_COLUMNS)
const videoChannelsSearchSortValidator = checkSort(SORTABLE_VIDEO_CHANNELS_SEARCH_COLUMNS)
const videoCommentThreadsSortValidator = checkSort(SORTABLE_VIDEO_COMMENT_THREADS_COLUMNS)
const videoRatesSortValidator = checkSort(SORTABLE_VIDEO_RATES_COLUMNS)
const blacklistSortValidator = checkSort(SORTABLE_BLACKLISTS_COLUMNS)
const videoChannelsSortValidator = checkSort(SORTABLE_VIDEO_CHANNELS_COLUMNS)
const followersSortValidator = checkSort(SORTABLE_FOLLOWERS_COLUMNS)
const followingSortValidator = checkSort(SORTABLE_FOLLOWING_COLUMNS)
const userSubscriptionsSortValidator = checkSort(SORTABLE_USER_SUBSCRIPTIONS_COLUMNS)
const accountsBlocklistSortValidator = checkSort(SORTABLE_ACCOUNTS_BLOCKLIST_COLUMNS)
const serversBlocklistSortValidator = checkSort(SORTABLE_SERVERS_BLOCKLIST_COLUMNS)
const userNotificationsSortValidator = checkSort(SORTABLE_USER_NOTIFICATIONS_COLUMNS)
const videoPlaylistsSortValidator = checkSort(SORTABLE_VIDEO_PLAYLISTS_COLUMNS)
const pluginsSortValidator = checkSort(SORTABLE_PLUGINS_COLUMNS)
const availablePluginsSortValidator = checkSort(SORTABLE_AVAILABLE_PLUGINS_COLUMNS)
const videoRedundanciesSortValidator = checkSort(SORTABLE_VIDEO_REDUNDANCIES_COLUMNS)

// ---------------------------------------------------------------------------

export {
  usersSortValidator,
  abusesSortValidator,
  videoChannelsSortValidator,
  videoImportsSortValidator,
  videosSearchSortValidator,
  videosSortValidator,
  blacklistSortValidator,
  accountsSortValidator,
  followersSortValidator,
  followingSortValidator,
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
  pluginsSortValidator
}
