import { SORTABLE_COLUMNS } from '../../initializers'
import { checkSort, createSortableColumns } from './utils'

// Initialize constants here for better performances
const SORTABLE_USERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USERS)
const SORTABLE_ACCOUNTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.ACCOUNTS)
const SORTABLE_JOBS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.JOBS)
const SORTABLE_VIDEO_ABUSES_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_ABUSES)
const SORTABLE_VIDEOS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS)
const SORTABLE_VIDEOS_SEARCH_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEOS_SEARCH)
const SORTABLE_VIDEO_CHANNELS_SEARCH_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_CHANNELS_SEARCH)
const SORTABLE_VIDEO_IMPORTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_IMPORTS)
const SORTABLE_VIDEO_COMMENT_THREADS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_COMMENT_THREADS)
const SORTABLE_BLACKLISTS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.BLACKLISTS)
const SORTABLE_VIDEO_CHANNELS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.VIDEO_CHANNELS)
const SORTABLE_FOLLOWERS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.FOLLOWERS)
const SORTABLE_FOLLOWING_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.FOLLOWING)
const SORTABLE_USER_SUBSCRIPTIONS_COLUMNS = createSortableColumns(SORTABLE_COLUMNS.USER_SUBSCRIPTIONS)

const usersSortValidator = checkSort(SORTABLE_USERS_COLUMNS)
const accountsSortValidator = checkSort(SORTABLE_ACCOUNTS_COLUMNS)
const jobsSortValidator = checkSort(SORTABLE_JOBS_COLUMNS)
const videoAbusesSortValidator = checkSort(SORTABLE_VIDEO_ABUSES_COLUMNS)
const videosSortValidator = checkSort(SORTABLE_VIDEOS_COLUMNS)
const videoImportsSortValidator = checkSort(SORTABLE_VIDEO_IMPORTS_COLUMNS)
const videosSearchSortValidator = checkSort(SORTABLE_VIDEOS_SEARCH_COLUMNS)
const videoChannelsSearchSortValidator = checkSort(SORTABLE_VIDEO_CHANNELS_SEARCH_COLUMNS)
const videoCommentThreadsSortValidator = checkSort(SORTABLE_VIDEO_COMMENT_THREADS_COLUMNS)
const blacklistSortValidator = checkSort(SORTABLE_BLACKLISTS_COLUMNS)
const videoChannelsSortValidator = checkSort(SORTABLE_VIDEO_CHANNELS_COLUMNS)
const followersSortValidator = checkSort(SORTABLE_FOLLOWERS_COLUMNS)
const followingSortValidator = checkSort(SORTABLE_FOLLOWING_COLUMNS)
const userSubscriptionsSortValidator = checkSort(SORTABLE_USER_SUBSCRIPTIONS_COLUMNS)

// ---------------------------------------------------------------------------

export {
  usersSortValidator,
  videoAbusesSortValidator,
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
  userSubscriptionsSortValidator,
  videoChannelsSearchSortValidator
}
