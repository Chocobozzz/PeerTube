import { maxBy, minBy, randomInt } from '@peertube/peertube-core-utils'
import {
  AbuseState,
  AbuseStateType,
  ActivityPubActorType,
  ActorImageType,
  ActorImageType_Type,
  FollowState,
  JobType,
  NSFWPolicyType,
  RunnerJobState,
  RunnerJobStateType,
  UserExportState,
  UserExportStateType,
  UserImportState,
  UserImportStateType,
  UserRegistrationState,
  UserRegistrationStateType,
  VideoChannelSyncState,
  VideoChannelSyncStateType,
  VideoCommentPolicy,
  VideoCommentPolicyType,
  VideoImportState,
  VideoImportStateType,
  VideoPlaylistPrivacy,
  VideoPlaylistPrivacyType,
  VideoPlaylistType,
  VideoPlaylistType_Type,
  VideoPrivacy,
  VideoPrivacyType,
  VideoRateType,
  VideoResolution,
  VideoState,
  VideoStateType
} from '@peertube/peertube-models'
import { isTestInstance, isTestOrDevInstance, root } from '@peertube/peertube-node-utils'
import { RepeatOptions } from 'bullmq'
import { Encoding, randomBytes } from 'crypto'
import { readJsonSync } from 'fs-extra/esm'
import invert from 'lodash-es/invert.js'
import { join } from 'path'
// Do not use barrels, remain constants as independent as possible
import { cpus } from 'os'
import { parseDurationToMs, sanitizeHost, sanitizeUrl } from '../helpers/core-utils.js'
import { CONFIG, registerConfigChangedHandler } from './config.js'

// ---------------------------------------------------------------------------

export const LAST_MIGRATION_VERSION = 865

// ---------------------------------------------------------------------------

export const API_VERSION = 'v1'
export const PEERTUBE_VERSION: string = readJsonSync(join(root(), 'package.json')).version

export const PAGINATION = {
  GLOBAL: {
    COUNT: {
      DEFAULT: 15,
      MAX: 100
    }
  },
  OUTBOX: {
    COUNT: {
      MAX: 50
    }
  }
}

export const WEBSERVER = {
  URL: '',
  HOST: '',
  SCHEME: '',
  WS: '',
  HOSTNAME: '',
  PORT: 0,

  RTMP_URL: '',
  RTMPS_URL: '',

  RTMP_BASE_LIVE_URL: '',
  RTMPS_BASE_LIVE_URL: ''
}

// Sortable columns per schema
export const SORTABLE_COLUMNS = {
  ADMIN_USERS: [ 'id', 'username', 'videoQuotaUsed', 'createdAt', 'lastLoginDate', 'role' ],
  USER_SUBSCRIPTIONS: [ 'id', 'createdAt' ],
  ACCOUNTS: [ 'createdAt' ],
  JOBS: [ 'createdAt' ],
  VIDEO_CHANNELS: [ 'id', 'name', 'updatedAt', 'createdAt' ],
  VIDEO_IMPORTS: [ 'createdAt' ],
  VIDEO_CHANNEL_SYNCS: [ 'externalChannelUrl', 'videoChannel', 'createdAt', 'lastSyncAt', 'state' ],

  VIDEO_COMMENT_THREADS: [ 'createdAt', 'totalReplies' ],
  VIDEO_COMMENTS: [ 'createdAt' ],

  VIDEO_PASSWORDS: [ 'createdAt' ],

  VIDEO_RATES: [ 'createdAt' ],
  BLACKLISTS: [ 'id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt' ],

  INSTANCE_FOLLOWERS: [ 'createdAt', 'state', 'score' ],
  INSTANCE_FOLLOWING: [ 'createdAt', 'redundancyAllowed', 'state' ],
  ACCOUNT_FOLLOWERS: [ 'createdAt' ],
  CHANNEL_FOLLOWERS: [ 'createdAt' ],

  USER_REGISTRATIONS: [ 'createdAt', 'state' ],

  RUNNERS: [ 'createdAt' ],
  RUNNER_REGISTRATION_TOKENS: [ 'createdAt' ],
  RUNNER_JOBS: [ 'updatedAt', 'createdAt', 'priority', 'state', 'progress' ],

  VIDEOS: [
    'name',
    'duration',
    'createdAt',
    'publishedAt',
    'originallyPublishedAt',
    'views',
    'likes',
    'trending',
    'hot',
    'best',
    'localVideoFilesSize'
  ],

  // Don't forget to update peertube-search-index with the same values
  VIDEOS_SEARCH: [ 'name', 'duration', 'createdAt', 'publishedAt', 'originallyPublishedAt', 'views', 'likes', 'match' ],
  VIDEO_CHANNELS_SEARCH: [ 'match', 'displayName', 'createdAt' ],
  VIDEO_PLAYLISTS_SEARCH: [ 'match', 'displayName', 'createdAt' ],

  ABUSES: [ 'id', 'createdAt', 'state' ],

  ACCOUNTS_BLOCKLIST: [ 'createdAt' ],
  SERVERS_BLOCKLIST: [ 'createdAt' ],

  WATCHED_WORDS_LISTS: [ 'createdAt', 'updatedAt', 'listName' ],

  USER_NOTIFICATIONS: [ 'createdAt', 'read' ],

  VIDEO_PLAYLISTS: [ 'name', 'displayName', 'createdAt', 'updatedAt' ],

  PLUGINS: [ 'name', 'createdAt', 'updatedAt' ],

  AVAILABLE_PLUGINS: [ 'npmName', 'popularity', 'trending' ],

  VIDEO_REDUNDANCIES: [ 'name' ]
}

export const ROUTE_CACHE_LIFETIME = {
  FEEDS: '15 minutes',
  ROBOTS: '2 hours',
  SITEMAP: '1 day',
  SECURITYTXT: '2 hours',
  NODEINFO: '10 minutes',
  DNT_POLICY: '1 week',
  ACTIVITY_PUB: {
    VIDEOS: '1 second' // 1 second, cache concurrent requests after a broadcast for example
  },
  STATS: '4 hours',
  WELL_KNOWN: '1 day'
}

// ---------------------------------------------------------------------------

// Number of points we add/remove after a successful/bad request
export const ACTOR_FOLLOW_SCORE = {
  PENALTY: -10,
  BONUS: 10,
  BASE: 1000,
  MAX: 10000
}

export const FOLLOW_STATES: { [ id: string ]: FollowState } = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
}

export const REMOTE_SCHEME = {
  HTTP: 'https',
  WS: 'wss'
}

// ---------------------------------------------------------------------------

export const JOB_ATTEMPTS: { [id in JobType]: number } = {
  'activitypub-http-broadcast': 1,
  'activitypub-http-broadcast-parallel': 1,
  'activitypub-http-unicast': 1,
  'activitypub-http-fetcher': 2,
  'activitypub-follow': 5,
  'activitypub-cleaner': 1,
  'video-file-import': 1,
  'video-transcoding': 1,
  'video-import': 1,
  'email': 5,
  'actor-keys': 3,
  'videos-views-stats': 1,
  'activitypub-refresher': 1,
  'video-redundancy': 1,
  'video-live-ending': 1,
  'video-studio-edition': 1,
  'manage-video-torrent': 1,
  'video-channel-import': 1,
  'after-video-channel-import': 1,
  'move-to-object-storage': 3,
  'move-to-file-system': 3,
  'transcoding-job-builder': 1,
  'generate-video-storyboard': 1,
  'notify': 1,
  'federate-video': 1,
  'create-user-export': 1,
  'import-user-archive': 1,
  'video-transcription': 2
}
// Excluded keys are jobs that can be configured by admins
export const JOB_CONCURRENCY: { [id in Exclude<JobType, 'video-transcoding' | 'video-import'>]: number } = {
  'activitypub-http-broadcast': 1,
  'activitypub-http-broadcast-parallel': 30,
  'activitypub-http-unicast': 30,
  'activitypub-http-fetcher': 3,
  'activitypub-cleaner': 1,
  'activitypub-follow': 1,
  'video-file-import': 1,
  'email': 5,
  'actor-keys': 1,
  'videos-views-stats': 1,
  'activitypub-refresher': 1,
  'video-redundancy': 1,
  'video-live-ending': 10,
  'video-studio-edition': 1,
  'manage-video-torrent': 1, // Keep it to 1 to prevent concurrency issues
  'move-to-object-storage': 1,
  'move-to-file-system': 1,
  'video-channel-import': 1,
  'after-video-channel-import': 1,
  'transcoding-job-builder': 1,
  'generate-video-storyboard': 1,
  'notify': 5,
  'federate-video': 3,
  'create-user-export': 1,
  'import-user-archive': 1,
  'video-transcription': 1
}
export const JOB_TTL: { [id in JobType]: number } = {
  'activitypub-http-broadcast': 60000 * 10, // 10 minutes
  'activitypub-http-broadcast-parallel': 60000 * 10, // 10 minutes
  'activitypub-http-unicast': 60000 * 10, // 10 minutes
  'activitypub-http-fetcher': 1000 * 3600 * 10, // 10 hours
  'activitypub-follow': 60000 * 10, // 10 minutes
  'activitypub-cleaner': 1000 * 3600, // 1 hour
  'video-file-import': 1000 * 3600, // 1 hour
  'video-transcoding': 1000 * 3600 * 48, // 2 days, transcoding could be long
  'video-studio-edition': 1000 * 3600 * 10, // 10 hours
  'video-import': CONFIG.IMPORT.VIDEOS.TIMEOUT,
  'email': 60000 * 10, // 10 minutes
  'actor-keys': 60000 * 20, // 20 minutes
  'videos-views-stats': undefined, // Unlimited
  'activitypub-refresher': 60000 * 10, // 10 minutes
  'video-redundancy': 1000 * 3600 * 3, // 3 hours
  'video-live-ending': 1000 * 60 * 10, // 10 minutes
  'generate-video-storyboard': 1000 * 3600 * 6, // 6 hours
  'manage-video-torrent': 1000 * 3600 * 3, // 3 hours
  'move-to-object-storage': 1000 * 60 * 60 * 3, // 3 hours
  'move-to-file-system': 1000 * 60 * 60 * 3, // 3 hours
  'video-channel-import': 1000 * 60 * 60 * 4, // 4 hours
  'after-video-channel-import': 60000 * 5, // 5 minutes
  'transcoding-job-builder': 60000, // 1 minute
  'notify': 60000 * 5, // 5 minutes
  'federate-video': 60000 * 5, // 5 minutes,
  'create-user-export': 60000 * 60 * 24, // 24 hours
  'import-user-archive': 60000 * 60 * 24, // 24 hours
  'video-transcription': 1000 * 3600 * 6 // 6 hours
}
export const REPEAT_JOBS: { [ id in JobType ]?: RepeatOptions } = {
  'videos-views-stats': {
    pattern: randomInt(1, 20) + ' * * * *' // Between 1-20 minutes past the hour
  },
  'activitypub-cleaner': {
    pattern: '30 5 * * ' + randomInt(0, 7) // 1 time per week (random day) at 5:30 AM
  }
}
export const JOB_PRIORITY = {
  TRANSCODING: 100,
  VIDEO_STUDIO: 150,
  TRANSCRIPTION: 200
}

export const JOB_REMOVAL_OPTIONS = {
  COUNT: 10000, // Max jobs to store

  SUCCESS: { // Success jobs
    'DEFAULT': parseDurationToMs('2 days'),

    'activitypub-http-broadcast-parallel': parseDurationToMs('10 minutes'),
    'activitypub-http-unicast': parseDurationToMs('1 hour'),
    'videos-views-stats': parseDurationToMs('3 hours'),
    'activitypub-refresher': parseDurationToMs('10 hours')
  },

  FAILURE: { // Failed job
    DEFAULT: parseDurationToMs('7 days')
  }
}

export const VIDEO_IMPORT_TIMEOUT = Math.floor(JOB_TTL['video-import'] * 0.9)

export const RUNNER_JOBS = {
  MAX_FAILURES: 5,
  LAST_CONTACT_UPDATE_INTERVAL: 30000
}

// ---------------------------------------------------------------------------

export const BROADCAST_CONCURRENCY = 30 // How many requests in parallel we do in activitypub-http-broadcast job
export const CRAWL_REQUEST_CONCURRENCY = 1 // How many requests in parallel to fetch remote data (likes, shares...)

export const AP_CLEANER = {
  CONCURRENCY: 10, // How many requests in parallel we do in activitypub-cleaner job
  UNAVAILABLE_TRESHOLD: 3, // How many attempts we do before removing an unavailable remote resource
  PERIOD: parseDurationToMs('1 week') // /!\ Has to be sync with REPEAT_JOBS
}

export const REQUEST_TIMEOUTS = {
  DEFAULT: 7000, // 7 seconds
  FILE: 30000, // 30 seconds
  VIDEO_FILE: 60000, // 1 minute
  REDUNDANCY: JOB_TTL['video-redundancy']
}

export const SCHEDULER_INTERVALS_MS = {
  RUNNER_JOB_WATCH_DOG: Math.min(CONFIG.REMOTE_RUNNERS.STALLED_JOBS.VOD, CONFIG.REMOTE_RUNNERS.STALLED_JOBS.LIVE),
  ACTOR_FOLLOW_SCORES: 60000 * 60, // 1 hour
  REMOVE_OLD_JOBS: 60000 * 60, // 1 hour
  UPDATE_VIDEOS: 60000, // 1 minute
  YOUTUBE_DL_UPDATE: 60000 * 60 * 24, // 1 day
  GEO_IP_UPDATE: 60000 * 60 * 24, // 1 day
  VIDEO_VIEWS_BUFFER_UPDATE: CONFIG.VIEWS.VIDEOS.LOCAL_BUFFER_UPDATE_INTERVAL,
  CHECK_PLUGINS: CONFIG.PLUGINS.INDEX.CHECK_LATEST_VERSIONS_INTERVAL,
  CHECK_PEERTUBE_VERSION: 60000 * 60 * 24, // 1 day
  AUTO_FOLLOW_INDEX_INSTANCES: 60000 * 60 * 24, // 1 day
  REMOVE_OLD_VIEWS: 60000 * 60 * 24, // 1 day
  REMOVE_OLD_HISTORY: 60000 * 60 * 24, // 1 day
  REMOVE_EXPIRED_USER_EXPORTS: 1000 * 3600, // 1 hour
  UPDATE_INBOX_STATS: 1000 * 60, // 1 minute
  REMOVE_DANGLING_RESUMABLE_UPLOADS: 60000 * 60, // 1 hour
  CHANNEL_SYNC_CHECK_INTERVAL: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.CHECK_INTERVAL
}

// ---------------------------------------------------------------------------

export const CONSTRAINTS_FIELDS = {
  USERS: {
    NAME: { min: 1, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 1000 }, // Length
    USERNAME: { min: 1, max: 50 }, // Length
    PASSWORD: { min: 6, max: 255 }, // Length
    VIDEO_QUOTA: { min: -1 },
    VIDEO_QUOTA_DAILY: { min: -1 },
    VIDEO_LANGUAGES: { max: 500 }, // Array length
    BLOCKED_REASON: { min: 3, max: 250 } // Length
  },
  ABUSES: {
    REASON: { min: 2, max: 3000 }, // Length
    MODERATION_COMMENT: { min: 2, max: 3000 } // Length
  },
  ABUSE_MESSAGES: {
    MESSAGE: { min: 2, max: 3000 } // Length
  },
  USER_REGISTRATIONS: {
    REASON_MESSAGE: { min: 2, max: 3000 }, // Length
    MODERATOR_MESSAGE: { min: 2, max: 3000 } // Length
  },
  VIDEO_BLACKLIST: {
    REASON: { min: 2, max: 300 } // Length
  },
  VIDEO_CHANNELS: {
    NAME: { min: 1, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 1000 }, // Length
    SUPPORT: { min: 3, max: 1000 }, // Length
    EXTERNAL_CHANNEL_URL: { min: 3, max: 2000 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_CHANNEL_SYNCS: {
    EXTERNAL_CHANNEL_URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_CAPTIONS: {
    CAPTION_FILE: {
      EXTNAME: [ '.vtt', '.srt' ],
      FILE_SIZE: {
        max: 20 * 1024 * 1024 // 20MB
      }
    }
  },
  VIDEO_IMPORTS: {
    URL: { min: 3, max: 2000 }, // Length
    TORRENT_NAME: { min: 3, max: 255 }, // Length
    TORRENT_FILE: {
      EXTNAME: [ '.torrent' ],
      FILE_SIZE: {
        max: 1024 * 200 // 200 KB
      }
    }
  },
  VIDEOS_REDUNDANCY: {
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_RATES: {
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEOS: {
    NAME: { min: 3, max: 120 }, // Length
    LANGUAGE: { min: 1, max: 10 }, // Length
    TRUNCATED_DESCRIPTION: { min: 3, max: 250 }, // Length
    DESCRIPTION: { min: 3, max: 10000 }, // Length
    SUPPORT: { min: 3, max: 1000 }, // Length
    IMAGE: {
      EXTNAME: [ '.png', '.jpg', '.jpeg', '.webp' ],
      FILE_SIZE: {
        max: 4 * 1024 * 1024 // 4MB
      }
    },
    EXTNAME: [] as string[],
    INFO_HASH: { min: 40, max: 40 }, // Length, info hash is 20 bytes length but we represent it in hexadecimal so 20 * 2
    DURATION: { min: 0 }, // Number
    TAGS: { min: 0, max: 5 }, // Number of total tags
    TAG: { min: 2, max: 30 }, // Length
    VIEWS: { min: 0 },
    LIKES: { min: 0 },
    DISLIKES: { min: 0 },
    FILE_SIZE: { min: -1 },
    PARTIAL_UPLOAD_SIZE: { max: 50 * 1024 * 1024 * 1024 }, // 50GB
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_SOURCE: {
    FILENAME: { min: 1, max: 1000 } // Length
  },
  VIDEO_PLAYLISTS: {
    NAME: { min: 1, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 1000 }, // Length
    URL: { min: 3, max: 2000 }, // Length
    IMAGE: {
      EXTNAME: [ '.jpg', '.jpeg' ],
      FILE_SIZE: {
        max: 4 * 1024 * 1024 // 4MB
      }
    }
  },
  ACTORS: {
    PUBLIC_KEY: { min: 10, max: 5000 }, // Length
    PRIVATE_KEY: { min: 10, max: 5000 }, // Length
    URL: { min: 3, max: 2000 }, // Length
    IMAGE: {
      EXTNAME: [ '.png', '.jpeg', '.jpg', '.gif', '.webp' ],
      FILE_SIZE: {
        max: 4 * 1024 * 1024 // 4MB
      }
    }
  },
  VIDEO_EVENTS: {
    COUNT: { min: 0 }
  },
  VIDEO_COMMENTS: {
    TEXT: { min: 1, max: 10000 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_SHARE: {
    URL: { min: 3, max: 2000 } // Length
  },
  CONTACT_FORM: {
    FROM_NAME: { min: 1, max: 120 }, // Length
    BODY: { min: 3, max: 5000 } // Length
  },
  PLUGINS: {
    NAME: { min: 1, max: 214 }, // Length
    DESCRIPTION: { min: 1, max: 20000 } // Length
  },
  COMMONS: {
    URL: { min: 5, max: 2000 } // Length
  },
  VIDEO_STUDIO: {
    TASKS: { min: 1, max: 10 }, // Number of tasks
    CUT_TIME: { min: 0 } // Value
  },
  LOGS: {
    CLIENT_MESSAGE: { min: 1, max: 1000 }, // Length
    CLIENT_STACK_TRACE: { min: 1, max: 15000 }, // Length
    CLIENT_META: { min: 1, max: 15000 }, // Length
    CLIENT_USER_AGENT: { min: 1, max: 200 } // Length
  },
  RUNNERS: {
    TOKEN: { min: 1, max: 1000 }, // Length
    NAME: { min: 1, max: 100 }, // Length
    DESCRIPTION: { min: 1, max: 1000 } // Length
  },
  RUNNER_JOBS: {
    TOKEN: { min: 1, max: 1000 }, // Length
    REASON: { min: 1, max: 5000 }, // Length
    ERROR_MESSAGE: { min: 1, max: 5000 }, // Length
    PROGRESS: { min: 0, max: 100 } // Value
  },
  VIDEO_PASSWORD: {
    LENGTH: { min: 2, max: 100 }
  },
  VIDEO_CHAPTERS: {
    TITLE: { min: 1, max: 100 } // Length
  },
  WATCHED_WORDS: {
    LIST_NAME: { min: 1, max: 100 }, // Length
    WORDS: { min: 1, max: 500 }, // Number of total words
    WORD: { min: 1, max: 100 } // Length
  }
}

export const VIEW_LIFETIME = {
  VIEW: CONFIG.VIEWS.VIDEOS.VIEW_EXPIRATION,
  VIEWER_COUNTER: 60000 * 2, // 2 minutes
  VIEWER_STATS: 60000 * 60 // 1 hour
}
export let VIEWER_SYNC_REDIS = 30000 // Sync viewer into redis

export const MAX_LOCAL_VIEWER_WATCH_SECTIONS = 100

export let CONTACT_FORM_LIFETIME = 60000 * 60 // 1 hour

export const DEFAULT_AUDIO_RESOLUTION = VideoResolution.H_480P
export const DEFAULT_AUDIO_MERGE_RESOLUTION = 25

export const VIDEO_RATE_TYPES: { [ id: string ]: VideoRateType } = {
  LIKE: 'like',
  DISLIKE: 'dislike'
}

export const USER_IMPORT = {
  MAX_PLAYLIST_ELEMENTS: 1000
}

export const FFMPEG_NICE = {
  // parent process defaults to niceness = 0
  // reminder: lower = higher priority, max value is 19, lowest is -20
  LIVE: 5, // prioritize over VOD and THUMBNAIL
  THUMBNAIL: 10,
  VOD: 15
}

export const VIDEO_CATEGORIES = {
  1: 'Music',
  2: 'Films',
  3: 'Vehicles',
  4: 'Art',
  5: 'Sports',
  6: 'Travels',
  7: 'Gaming',
  8: 'People',
  9: 'Comedy',
  10: 'Entertainment',
  11: 'News & Politics',
  12: 'How To',
  13: 'Education',
  14: 'Activism',
  15: 'Science & Technology',
  16: 'Animals',
  17: 'Kids',
  18: 'Food'
}

// See https://creativecommons.org/licenses/?lang=en
export const VIDEO_LICENCES = {
  1: 'Attribution',
  2: 'Attribution - Share Alike',
  3: 'Attribution - No Derivatives',
  4: 'Attribution - Non Commercial',
  5: 'Attribution - Non Commercial - Share Alike',
  6: 'Attribution - Non Commercial - No Derivatives',
  7: 'Public Domain Dedication'
}

export const VIDEO_LANGUAGES: { [id: string]: string } = {}

export const VIDEO_PRIVACIES: { [ id in VideoPrivacyType ]: string } = {
  [VideoPrivacy.PUBLIC]: 'Public',
  [VideoPrivacy.UNLISTED]: 'Unlisted',
  [VideoPrivacy.PRIVATE]: 'Private',
  [VideoPrivacy.INTERNAL]: 'Internal',
  [VideoPrivacy.PASSWORD_PROTECTED]: 'Password protected'
}

export const VIDEO_STATES: { [ id in VideoStateType ]: string } = {
  [VideoState.PUBLISHED]: 'Published',
  [VideoState.TO_TRANSCODE]: 'To transcode',
  [VideoState.TO_IMPORT]: 'To import',
  [VideoState.WAITING_FOR_LIVE]: 'Waiting for livestream',
  [VideoState.LIVE_ENDED]: 'Livestream ended',
  [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE]: 'To move to an external storage',
  [VideoState.TRANSCODING_FAILED]: 'Transcoding failed',
  [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED]: 'External storage move failed',
  [VideoState.TO_EDIT]: 'To edit',
  [VideoState.TO_MOVE_TO_FILE_SYSTEM]: 'To move to file system',
  [VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED]: 'Move to file system failed'
}

export const VIDEO_IMPORT_STATES: { [ id in VideoImportStateType ]: string } = {
  [VideoImportState.FAILED]: 'Failed',
  [VideoImportState.PENDING]: 'Pending',
  [VideoImportState.SUCCESS]: 'Success',
  [VideoImportState.REJECTED]: 'Rejected',
  [VideoImportState.CANCELLED]: 'Cancelled',
  [VideoImportState.PROCESSING]: 'Processing'
}

export const VIDEO_CHANNEL_SYNC_STATE: { [ id in VideoChannelSyncStateType ]: string } = {
  [VideoChannelSyncState.FAILED]: 'Failed',
  [VideoChannelSyncState.SYNCED]: 'Synchronized',
  [VideoChannelSyncState.PROCESSING]: 'Processing',
  [VideoChannelSyncState.WAITING_FIRST_RUN]: 'Waiting first run'
}

export const ABUSE_STATES: { [ id in AbuseStateType ]: string } = {
  [AbuseState.PENDING]: 'Pending',
  [AbuseState.REJECTED]: 'Rejected',
  [AbuseState.ACCEPTED]: 'Accepted'
}

export const USER_REGISTRATION_STATES: { [ id in UserRegistrationStateType ]: string } = {
  [UserRegistrationState.PENDING]: 'Pending',
  [UserRegistrationState.REJECTED]: 'Rejected',
  [UserRegistrationState.ACCEPTED]: 'Accepted'
}

export const VIDEO_PLAYLIST_PRIVACIES: { [ id in VideoPlaylistPrivacyType ]: string } = {
  [VideoPlaylistPrivacy.PUBLIC]: 'Public',
  [VideoPlaylistPrivacy.UNLISTED]: 'Unlisted',
  [VideoPlaylistPrivacy.PRIVATE]: 'Private'
}

export const VIDEO_PLAYLIST_TYPES: { [ id in VideoPlaylistType_Type ]: string } = {
  [VideoPlaylistType.REGULAR]: 'Regular',
  [VideoPlaylistType.WATCH_LATER]: 'Watch later'
}

export const RUNNER_JOB_STATES: { [ id in RunnerJobStateType ]: string } = {
  [RunnerJobState.PROCESSING]: 'Processing',
  [RunnerJobState.COMPLETED]: 'Completed',
  [RunnerJobState.COMPLETING]: 'Completing',
  [RunnerJobState.PENDING]: 'Pending',
  [RunnerJobState.ERRORED]: 'Errored',
  [RunnerJobState.WAITING_FOR_PARENT_JOB]: 'Waiting for parent job to finish',
  [RunnerJobState.CANCELLED]: 'Cancelled',
  [RunnerJobState.PARENT_ERRORED]: 'Parent job failed',
  [RunnerJobState.PARENT_CANCELLED]: 'Parent job cancelled'
}

export const USER_EXPORT_STATES: { [ id in UserExportStateType ]: string } = {
  [UserExportState.PENDING]: 'Pending',
  [UserExportState.PROCESSING]: 'Processing',
  [UserExportState.COMPLETED]: 'Completed',
  [UserExportState.ERRORED]: 'Failed'
}

export const USER_IMPORT_STATES: { [ id in UserImportStateType ]: string } = {
  [UserImportState.PENDING]: 'Pending',
  [UserImportState.PROCESSING]: 'Processing',
  [UserImportState.COMPLETED]: 'Completed',
  [UserImportState.ERRORED]: 'Failed'
}

export const VIDEO_COMMENTS_POLICY: { [ id in VideoCommentPolicyType ]: string } = {
  [VideoCommentPolicy.DISABLED]: 'Disabled',
  [VideoCommentPolicy.ENABLED]: 'Enabled',
  [VideoCommentPolicy.REQUIRES_APPROVAL]: 'Requires approval'
}

export const MIMETYPES = {
  AUDIO: {
    MIMETYPE_EXT: {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',

      'application/ogg': '.ogg',
      'audio/ogg': '.ogg',

      'audio/x-ms-wma': '.wma',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',

      'audio/x-flac': '.flac',
      'audio/flac': '.flac',

      'audio/vnd.dlna.adts': '.aac',
      'audio/aac': '.aac',

      // Keep priority for preferred mime type
      'audio/m4a': '.m4a',
      'audio/x-m4a': '.m4a',
      'audio/mp4': '.m4a',

      'audio/vnd.dolby.dd-raw': '.ac3',
      'audio/ac3': '.ac3'
    },
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  VIDEO: {
    MIMETYPE_EXT: null as { [ id: string ]: string | string[] },
    MIMETYPES_REGEX: null as string,
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  IMAGE: {
    MIMETYPE_EXT: {
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/jpg': '.jpg',
      'image/jpeg': '.jpg'
    },
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  VIDEO_CAPTIONS: {
    MIMETYPE_EXT: {
      'text/vtt': '.vtt',
      'application/x-subrip': '.srt',
      'text/plain': '.srt'
    },
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  TORRENT: {
    MIMETYPE_EXT: {
      'application/x-bittorrent': '.torrent'
    }
  },
  M3U8: {
    MIMETYPE_EXT: {
      'application/vnd.apple.mpegurl': '.m3u8'
    }
  },
  AP_VIDEO: {
    MIMETYPE_EXT: {
      'video/mp4': '.mp4',
      'video/ogg': '.ogv',
      'video/webm': '.webm',
      'audio/mp4': '.mp4'
    }
  },
  AP_TORRENT: {
    MIMETYPE_EXT: {
      'application/x-bittorrent': '.torrent'
    }
  },
  AP_MAGNET: {
    MIMETYPE_EXT: {
      'application/x-bittorrent;x-scheme-handler/magnet': '.magnet'
    }
  }
}

MIMETYPES.AUDIO.EXT_MIMETYPE = invert(MIMETYPES.AUDIO.MIMETYPE_EXT)
MIMETYPES.IMAGE.EXT_MIMETYPE = invert(MIMETYPES.IMAGE.MIMETYPE_EXT)
MIMETYPES.VIDEO_CAPTIONS.EXT_MIMETYPE = invert(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT)

export const BINARY_CONTENT_TYPES = new Set([
  'binary/octet-stream',
  'application/octet-stream',
  'application/x-binary'
])

// ---------------------------------------------------------------------------

export const OVERVIEWS = {
  VIDEOS: {
    SAMPLE_THRESHOLD: 6,
    SAMPLES_COUNT: 20
  }
}

// ---------------------------------------------------------------------------

export const SERVER_ACTOR_NAME = 'peertube'

export const ACTIVITY_PUB = {
  POTENTIAL_ACCEPT_HEADERS: [
    'application/activity+json',
    'application/ld+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  ],
  ACCEPT_HEADER: 'application/activity+json, application/ld+json',
  COLLECTION_ITEMS_PER_PAGE: 10,
  FETCH_PAGE_LIMIT: 2000,
  MAX_RECURSION_COMMENTS: 100,
  ACTOR_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2, // 2 days
  VIDEO_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2, // 2 days
  VIDEO_PLAYLIST_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2 // 2 days
}

export const ACTIVITY_PUB_ACTOR_TYPES: { [ id: string ]: ActivityPubActorType } = {
  GROUP: 'Group',
  PERSON: 'Person',
  APPLICATION: 'Application',
  ORGANIZATION: 'Organization',
  SERVICE: 'Service'
}

export const HTTP_SIGNATURE = {
  HEADER_NAME: 'signature',
  ALGORITHM: 'rsa-sha256',
  HEADERS_TO_SIGN_WITH_PAYLOAD: [ '(request-target)', 'host', 'date', 'digest' ],
  HEADERS_TO_SIGN_WITHOUT_PAYLOAD: [ '(request-target)', 'host', 'date' ],
  CLOCK_SKEW_SECONDS: 1800
}

// ---------------------------------------------------------------------------

export let PRIVATE_RSA_KEY_SIZE = 2048

// Password encryption
export const BCRYPT_SALT_SIZE = 10

export const ENCRYPTION = {
  ALGORITHM: 'aes-256-cbc',
  IV: 16,
  SALT: 'peertube',
  ENCODING: 'hex' as Encoding
}

export const USER_PASSWORD_RESET_LIFETIME = 60000 * 60 // 60 minutes
export const USER_PASSWORD_CREATE_LIFETIME = 60000 * 60 * 24 * 7 // 7 days

export const TWO_FACTOR_AUTH_REQUEST_TOKEN_LIFETIME = 60000 * 10 // 10 minutes
export let JWT_TOKEN_USER_EXPORT_FILE_LIFETIME = '15 minutes'

export const EMAIL_VERIFY_LIFETIME = 60000 * 60 // 60 minutes

export const NSFW_POLICY_TYPES: { [ id: string ]: NSFWPolicyType } = {
  DO_NOT_LIST: 'do_not_list',
  BLUR: 'blur',
  DISPLAY: 'display'
}

// ---------------------------------------------------------------------------

export const USER_EXPORT_MAX_ITEMS = 1000
export const USER_EXPORT_FILE_PREFIX = 'user-export-'

// ---------------------------------------------------------------------------

// Express static paths (router)
export const STATIC_PATHS = {
  // Need to keep this legacy path for previously generated torrents
  LEGACY_WEB_VIDEOS: '/static/webseed/',
  WEB_VIDEOS: '/static/web-videos/',

  // Need to keep this legacy path for previously generated torrents
  LEGACY_PRIVATE_WEB_VIDEOS: '/static/webseed/private/',
  PRIVATE_WEB_VIDEOS: '/static/web-videos/private/',

  REDUNDANCY: '/static/redundancy/',

  STREAMING_PLAYLISTS: {
    HLS: '/static/streaming-playlists/hls',
    PRIVATE_HLS: '/static/streaming-playlists/hls/private/'
  }
}
export const DOWNLOAD_PATHS = {
  TORRENTS: '/download/torrents/',
  GENERATE_VIDEO: '/download/videos/generate/',
  WEB_VIDEOS: '/download/web-videos/',
  HLS_VIDEOS: '/download/streaming-playlists/hls/videos/',
  USER_EXPORTS: '/download/user-exports/',
  ORIGINAL_VIDEO_FILE: '/download/original-video-files/'
}
export const LAZY_STATIC_PATHS = {
  THUMBNAILS: '/lazy-static/thumbnails/',
  BANNERS: '/lazy-static/banners/',
  AVATARS: '/lazy-static/avatars/',
  PREVIEWS: '/lazy-static/previews/',
  VIDEO_CAPTIONS: '/lazy-static/video-captions/',
  TORRENTS: '/lazy-static/torrents/',
  STORYBOARDS: '/lazy-static/storyboards/'
}
export const OBJECT_STORAGE_PROXY_PATHS = {
  // Need to keep this legacy path for previously generated torrents
  LEGACY_PRIVATE_WEB_VIDEOS: '/object-storage-proxy/webseed/private/',
  PRIVATE_WEB_VIDEOS: '/object-storage-proxy/web-videos/private/',

  STREAMING_PLAYLISTS: {
    PRIVATE_HLS: '/object-storage-proxy/streaming-playlists/hls/private/'
  }
}

// Cache control
export const STATIC_MAX_AGE = {
  SERVER: '2h',
  LAZY_SERVER: '2d',
  CLIENT: '30d'
}

// Videos thumbnail size
export const THUMBNAILS_SIZE = {
  width: minBy(CONFIG.THUMBNAILS.SIZES, 'width').width,
  height: minBy(CONFIG.THUMBNAILS.SIZES, 'width').height,
  minRemoteWidth: 150
}
export const PREVIEWS_SIZE = {
  width: maxBy(CONFIG.THUMBNAILS.SIZES, 'width').width,
  height: maxBy(CONFIG.THUMBNAILS.SIZES, 'width').height,
  minRemoteWidth: 400
}
export const ACTOR_IMAGES_SIZE: { [key in ActorImageType_Type]: { width: number, height: number }[] } = {
  [ActorImageType.AVATAR]: [ // 1/1 ratio
    {
      width: 1500,
      height: 1500
    },
    {
      width: 600,
      height: 600
    },
    {
      width: 120,
      height: 120
    },
    {
      width: 48,
      height: 48
    }
  ],
  [ActorImageType.BANNER]: [ // 6/1 ratio
    {
      width: 1920,
      height: 317
    },
    {
      width: 600,
      height: 100
    }
  ]
}

export const STORYBOARD = {
  SPRITE_MAX_SIZE: 192,
  SPRITES_MAX_EDGE_COUNT: 11
}

export const EMBED_SIZE = {
  width: 560,
  height: 315
}

// Sub folders of cache directory
export const FILES_CACHE = {
  PREVIEWS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'previews'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  },
  STORYBOARDS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'storyboards'),
    MAX_AGE: 1000 * 3600 * 24 // 24 hours
  },
  VIDEO_CAPTIONS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'video-captions'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  },
  TORRENTS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'torrents'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  }
}

export const LRU_CACHE = {
  USER_TOKENS: {
    MAX_SIZE: 1000
  },
  FILENAME_TO_PATH_PERMANENT_FILE_CACHE: {
    MAX_SIZE: 1000
  },
  STATIC_VIDEO_FILES_RIGHTS_CHECK: {
    MAX_SIZE: 5000,
    TTL: parseDurationToMs('10 seconds')
  },
  VIDEO_TOKENS: {
    MAX_SIZE: 100_000,
    TTL: parseDurationToMs('8 hours')
  },
  WATCHED_WORDS_REGEX: {
    MAX_SIZE: 100,
    TTL: parseDurationToMs('24 hours')
  },
  TRACKER_IPS: {
    MAX_SIZE: 100_000
  }
}

export const DIRECTORIES = {
  RESUMABLE_UPLOAD: join(CONFIG.STORAGE.TMP_DIR, 'resumable-uploads'),

  HLS_STREAMING_PLAYLIST: {
    PUBLIC: join(CONFIG.STORAGE.STREAMING_PLAYLISTS_DIR, 'hls'),
    PRIVATE: join(CONFIG.STORAGE.STREAMING_PLAYLISTS_DIR, 'hls', 'private')
  },

  WEB_VIDEOS: {
    PUBLIC: CONFIG.STORAGE.WEB_VIDEOS_DIR,
    PRIVATE: join(CONFIG.STORAGE.WEB_VIDEOS_DIR, 'private')
  },

  ORIGINAL_VIDEOS: CONFIG.STORAGE.ORIGINAL_VIDEO_FILES_DIR,

  HLS_REDUNDANCY: join(CONFIG.STORAGE.REDUNDANCY_DIR, 'hls'),

  LOCAL_PIP_DIRECTORY: join(CONFIG.STORAGE.BIN_DIR, 'pip')
}

export const RESUMABLE_UPLOAD_SESSION_LIFETIME = SCHEDULER_INTERVALS_MS.REMOVE_DANGLING_RESUMABLE_UPLOADS

export const VIDEO_LIVE = {
  EXTENSION: '.ts',
  CLEANUP_DELAY: 1000 * 60 * 5, // 5 minutes
  SEGMENT_TIME_SECONDS: {
    DEFAULT_LATENCY: 4, // 4 seconds
    SMALL_LATENCY: 2 // 2 seconds
  },
  SEGMENTS_LIST_SIZE: 15, // 15 maximum segments in live playlist
  REPLAY_DIRECTORY: 'replay',
  EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION: 4,
  MAX_SOCKET_WAITING_DATA: 1024 * 1000 * 100, // 100MB
  RTMP: {
    CHUNK_SIZE: 60000,
    GOP_CACHE: true,
    PING: 60,
    PING_TIMEOUT: 30,
    BASE_PATH: 'live'
  }
}

export const MEMOIZE_TTL = {
  OVERVIEWS_SAMPLE: 1000 * 3600 * 4, // 4 hours
  INFO_HASH_EXISTS: 1000 * 60, // 1 minute
  VIDEO_DURATION: 1000 * 10, // 10 seconds
  LIVE_ABLE_TO_UPLOAD: 1000 * 60, // 1 minute
  LIVE_CHECK_SOCKET_HEALTH: 1000 * 60, // 1 minute
  GET_STATS_FOR_OPEN_TELEMETRY_METRICS: 1000 * 60, // 1 minute
  EMBED_HTML: 1000 * 10 // 10 seconds
}

export const MEMOIZE_LENGTH = {
  INFO_HASH_EXISTS: 200,
  VIDEO_DURATION: 200
}

export const totalCPUs = Math.max(cpus().length, 1)

export const WORKER_THREADS = {
  DOWNLOAD_IMAGE: {
    CONCURRENCY: 3,
    MAX_THREADS: 1
  },
  PROCESS_IMAGE: {
    CONCURRENCY: 1,
    MAX_THREADS: Math.min(totalCPUs, 5)
  },
  GET_IMAGE_SIZE: {
    CONCURRENCY: 1,
    MAX_THREADS: Math.min(totalCPUs, 5)
  },
  SIGN_JSON_LD_OBJECT: {
    CONCURRENCY: 1,
    MAX_THREADS: 1 // FIXME: we would want 2 threads but there is an issue with JSONLD in worker thread where CPU jumps and stays at 100%
  },
  BUILD_DIGEST: {
    CONCURRENCY: 1,
    MAX_THREADS: 1
  }
}

export const REDUNDANCY = {
  VIDEOS: {
    RANDOMIZED_FACTOR: 5
  }
}

export const ACCEPT_HEADERS = [ 'html', 'application/json' ].concat(ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS)
export const OTP = {
  HEADER_NAME: 'x-peertube-otp',
  HEADER_REQUIRED_VALUE: 'required; app'
}

export const ASSETS_PATH = {
  DEFAULT_AUDIO_BACKGROUND: join(root(), 'dist', 'core', 'assets', 'default-audio-background.jpg'),
  DEFAULT_LIVE_BACKGROUND: join(root(), 'dist', 'core', 'assets', 'default-live-background.jpg')
}

// ---------------------------------------------------------------------------

export const CUSTOM_HTML_TAG_COMMENTS = {
  TITLE: '<!-- title tag -->',
  DESCRIPTION: '<!-- description tag -->',
  CUSTOM_CSS: '<!-- custom css tag -->',
  META_TAGS: '<!-- meta tags -->',
  SERVER_CONFIG: '<!-- server config -->'
}

export const MAX_LOGS_OUTPUT_CHARACTERS = 10 * 1000 * 1000
export const LOG_FILENAME = 'peertube.log'
export const AUDIT_LOG_FILENAME = 'peertube-audit.log'

// ---------------------------------------------------------------------------

export const TRACKER_RATE_LIMITS = {
  INTERVAL: 60000 * 5, // 5 minutes
  ANNOUNCES_PER_IP_PER_INFOHASH: 15, // maximum announces per torrent in the interval
  ANNOUNCES_PER_IP: 30, // maximum announces for all our torrents in the interval
  BLOCK_IP_LIFETIME: parseDurationToMs('3 minutes')
}

export const P2P_MEDIA_LOADER_PEER_VERSION = 2

// ---------------------------------------------------------------------------

export const PLUGIN_GLOBAL_CSS_FILE_NAME = 'plugins-global.css'
export const PLUGIN_GLOBAL_CSS_PATH = join(CONFIG.STORAGE.TMP_DIR, PLUGIN_GLOBAL_CSS_FILE_NAME)

export let PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME = 1000 * 60 * 5 // 5 minutes

export const DEFAULT_THEME_NAME = 'default'
export const DEFAULT_USER_THEME_NAME = 'instance-default'

// ---------------------------------------------------------------------------

export const SEARCH_INDEX = {
  ROUTES: {
    VIDEOS: '/api/v1/search/videos',
    VIDEO_CHANNELS: '/api/v1/search/video-channels'
  }
}

// ---------------------------------------------------------------------------

export const STATS_TIMESERIE = {
  MAX_DAYS: 365 * 10 // Around 10 years
}

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (process.env.PRODUCTION_CONSTANTS !== 'true') {
  if (isTestOrDevInstance()) {
    PRIVATE_RSA_KEY_SIZE = 1024

    ACTOR_FOLLOW_SCORE.BASE = 20

    REMOTE_SCHEME.HTTP = 'http'
    REMOTE_SCHEME.WS = 'ws'

    STATIC_MAX_AGE.SERVER = '0'

    SCHEDULER_INTERVALS_MS.ACTOR_FOLLOW_SCORES = 1000
    SCHEDULER_INTERVALS_MS.REMOVE_OLD_JOBS = 10000
    SCHEDULER_INTERVALS_MS.REMOVE_OLD_HISTORY = 5000
    SCHEDULER_INTERVALS_MS.REMOVE_OLD_VIEWS = 5000
    SCHEDULER_INTERVALS_MS.UPDATE_VIDEOS = 5000
    SCHEDULER_INTERVALS_MS.AUTO_FOLLOW_INDEX_INSTANCES = 5000
    SCHEDULER_INTERVALS_MS.UPDATE_INBOX_STATS = 5000
    SCHEDULER_INTERVALS_MS.CHECK_PEERTUBE_VERSION = 2000

    REPEAT_JOBS['videos-views-stats'] = { every: 5000 }

    REPEAT_JOBS['activitypub-cleaner'] = { every: 5000 }
    AP_CLEANER.PERIOD = 5000

    REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR = 1

    CONTACT_FORM_LIFETIME = 1000 // 1 second

    JOB_ATTEMPTS['email'] = 1

    FILES_CACHE.VIDEO_CAPTIONS.MAX_AGE = 3000
    MEMOIZE_TTL.OVERVIEWS_SAMPLE = 3000
    MEMOIZE_TTL.LIVE_ABLE_TO_UPLOAD = 3000
    MEMOIZE_TTL.EMBED_HTML = 1
    OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD = 2

    PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME = 5000

    JOB_REMOVAL_OPTIONS.SUCCESS['videos-views-stats'] = 10000

    VIEWER_SYNC_REDIS = 1000
  }

  if (isTestInstance()) {
    ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE = 2
    ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL = 10 * 1000 // 10 seconds
    ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL = 10 * 1000 // 10 seconds
    ACTIVITY_PUB.VIDEO_PLAYLIST_REFRESH_INTERVAL = 10 * 1000 // 10 seconds

    CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max = 100 * 1024 // 100KB
    CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max = 400 * 1024 // 400KB

    VIEW_LIFETIME.VIEWER_COUNTER = 1000 * 5 // 5 second
    VIEW_LIFETIME.VIEWER_STATS = 1000 * 5 // 5 second

    VIDEO_LIVE.CLEANUP_DELAY = getIntEnv('PEERTUBE_TEST_CONSTANTS_VIDEO_LIVE_CLEANUP_DELAY') ?? 5000
    VIDEO_LIVE.SEGMENT_TIME_SECONDS.DEFAULT_LATENCY = 2
    VIDEO_LIVE.SEGMENT_TIME_SECONDS.SMALL_LATENCY = 1
    VIDEO_LIVE.EDGE_LIVE_DELAY_SEGMENTS_NOTIFICATION = 1

    RUNNER_JOBS.LAST_CONTACT_UPDATE_INTERVAL = 2000

    JWT_TOKEN_USER_EXPORT_FILE_LIFETIME = '2 seconds'
  }
}

updateWebserverUrls()
updateWebserverConfig()

registerConfigChangedHandler(() => {
  updateWebserverUrls()
  updateWebserverConfig()
})

export async function loadLanguages () {
  if (Object.keys(VIDEO_LANGUAGES).length !== 0) return

  Object.assign(VIDEO_LANGUAGES, await buildLanguages())
}

// ---------------------------------------------------------------------------

export const FILES_CONTENT_HASH = {
  MANIFEST: generateContentHash(),
  FAVICON: generateContentHash(),
  LOGO: generateContentHash()
}

// ---------------------------------------------------------------------------

export const VIDEO_FILTERS = {
  WATERMARK: {
    SIZE_RATIO: 1 / 10,
    HORIZONTAL_MARGIN_RATIO: 1 / 20,
    VERTICAL_MARGIN_RATIO: 1 / 20
  }
}

export async function buildLanguages () {
  const { iso6393 } = await import('iso-639-3')

  const languages: { [id: string]: string } = {}

  const additionalLanguages = {
    sgn: true, // Sign languages (macro language)
    ase: true, // American sign language
    asq: true, // Austrian sign language
    sdl: true, // Arabian sign language
    bfi: true, // British sign language
    bzs: true, // Brazilian sign language
    csl: true, // Chinese sign language
    cse: true, // Czech sign language
    dsl: true, // Danish sign language
    fsl: true, // French sign language
    gsg: true, // German sign language
    pks: true, // Pakistan sign language
    jsl: true, // Japanese sign language
    sfs: true, // South African sign language
    swl: true, // Swedish sign language
    rsl: true, // Russian sign language
    fse: true, // Finnish sign language

    kab: true, // Kabyle
    gcf: true, // Guadeloupean

    lat: true, // Latin

    epo: true, // Esperanto
    tlh: true, // Klingon
    jbo: true, // Lojban
    avk: true, // Kotava

    zxx: true // No linguistic content (ISO-639-2)
  }

  // Only add ISO639-1 languages and some sign languages (ISO639-3)
  iso6393
    .filter(l => {
      return (l.iso6391 !== undefined && l.type === 'living') ||
        additionalLanguages[l.iso6393] === true
    })
    .forEach(l => { languages[l.iso6391 || l.iso6393] = l.name })

  // Override Occitan label
  languages['oc'] = 'Occitan'
  languages['el'] = 'Greek'
  languages['tok'] = 'Toki Pona'

  // Override Portuguese label
  languages['pt'] = 'Portuguese (Brazilian)'
  languages['pt-PT'] = 'Portuguese (Portugal)'

  // Override Spanish labels
  languages['es'] = 'Spanish (Spain)'
  languages['es-419'] = 'Spanish (Latin America)'

  // Chinese languages
  languages['zh-Hans'] = 'Simplified Chinese'
  languages['zh-Hant'] = 'Traditional Chinese'

  // Catalan languages
  languages['ca-valencia'] = 'Valencian'

  return languages
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildVideoMimetypeExt () {
  const data = {
    // streamable formats that warrant cross-browser compatibility
    'video/webm': '.webm',
    // We'll add .ogg if additional extensions are enabled
    // We could add .ogg here but since it could be an audio file,
    // it would be confusing for users because PeerTube will refuse their file (based on the mimetype)
    'video/ogg': [ '.ogv' ],
    'video/mp4': '.mp4'
  }

  if (CONFIG.TRANSCODING.ENABLED) {
    if (CONFIG.TRANSCODING.ALLOW_ADDITIONAL_EXTENSIONS) {
      data['video/ogg'].push('.ogg')

      Object.assign(data, {
        'video/x-matroska': '.mkv',

        // Developed by Apple
        'video/quicktime': [ '.mov', '.qt', '.mqv' ], // often used as output format by editing software
        'video/mov': '.mov', // Windows: https://github.com/Chocobozzz/PeerTube/issues/6669
        'video/x-m4v': '.m4v',
        'video/m4v': '.m4v',

        // Developed by the Adobe Flash Platform
        'video/x-flv': '.flv',
        'video/x-f4v': '.f4v', // replacement for flv

        // Developed by Microsoft
        'video/x-ms-wmv': '.wmv',
        'video/x-msvideo': '.avi',
        'video/avi': '.avi',

        // Developed by 3GPP
        // common video formats for cell phones
        'video/3gpp': [ '.3gp', '.3gpp' ],
        'video/3gpp2': [ '.3g2', '.3gpp2' ],

        // Developed by FFmpeg/Mplayer
        'application/x-nut': '.nut',

        // The standard video format used by many Sony and Panasonic HD camcorders.
        // It is also used for storing high definition video on Blu-ray discs.
        'video/mp2t': '.mts',
        'video/vnd.dlna.mpeg-tts': '.mts',

        'video/m2ts': '.m2ts',

        // Old formats reliant on MPEG-1/MPEG-2
        'video/mpv': '.mpv',
        'video/mpeg2': '.m2v',
        'video/mpeg': [ '.m1v', '.mpg', '.mpe', '.mpeg', '.vob' ],
        'video/dvd': '.vob',

        // Could be anything
        'application/octet-stream': null,
        'application/mxf': '.mxf' // often used as exchange format by editing software
      })
    }

    if (CONFIG.TRANSCODING.ALLOW_AUDIO_FILES) {
      Object.assign(data, MIMETYPES.AUDIO.MIMETYPE_EXT)
    }
  }

  return data
}

function updateWebserverUrls () {
  WEBSERVER.URL = sanitizeUrl(CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT)
  WEBSERVER.HOST = sanitizeHost(CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT, REMOTE_SCHEME.HTTP)
  WEBSERVER.WS = CONFIG.WEBSERVER.WS

  WEBSERVER.SCHEME = CONFIG.WEBSERVER.SCHEME
  WEBSERVER.HOSTNAME = CONFIG.WEBSERVER.HOSTNAME
  WEBSERVER.PORT = CONFIG.WEBSERVER.PORT

  const rtmpHostname = CONFIG.LIVE.RTMP.PUBLIC_HOSTNAME || CONFIG.WEBSERVER.HOSTNAME
  const rtmpsHostname = CONFIG.LIVE.RTMPS.PUBLIC_HOSTNAME || CONFIG.WEBSERVER.HOSTNAME

  WEBSERVER.RTMP_URL = 'rtmp://' + rtmpHostname + ':' + CONFIG.LIVE.RTMP.PORT
  WEBSERVER.RTMPS_URL = 'rtmps://' + rtmpsHostname + ':' + CONFIG.LIVE.RTMPS.PORT

  WEBSERVER.RTMP_BASE_LIVE_URL = WEBSERVER.RTMP_URL + '/' + VIDEO_LIVE.RTMP.BASE_PATH
  WEBSERVER.RTMPS_BASE_LIVE_URL = WEBSERVER.RTMPS_URL + '/' + VIDEO_LIVE.RTMP.BASE_PATH
}

function updateWebserverConfig () {
  MIMETYPES.VIDEO.MIMETYPE_EXT = buildVideoMimetypeExt()
  MIMETYPES.VIDEO.MIMETYPES_REGEX = buildMimetypesRegex(MIMETYPES.VIDEO.MIMETYPE_EXT)

  MIMETYPES.VIDEO.EXT_MIMETYPE = buildVideoExtMimetype(MIMETYPES.VIDEO.MIMETYPE_EXT)

  CONSTRAINTS_FIELDS.VIDEOS.EXTNAME = Object.keys(MIMETYPES.VIDEO.EXT_MIMETYPE)
}

function buildVideoExtMimetype (obj: { [ id: string ]: string | string[] }) {
  const result: { [id: string]: string } = {}

  for (const mimetype of Object.keys(obj)) {
    const value = obj[mimetype]
    if (!value) continue

    const extensions = Array.isArray(value) ? value : [ value ]

    for (const extension of extensions) {
      result[extension] = mimetype
    }
  }

  return result
}

function buildMimetypesRegex (obj: { [id: string]: string | string[] }) {
  return Object.keys(obj)
    .map(m => `(${m})`)
    .join('|')
}

function generateContentHash () {
  return randomBytes(20).toString('hex')
}

function getIntEnv (path: string) {
  if (process.env[path]) return parseInt(process.env[path])

  return undefined
}
