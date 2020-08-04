import { join } from 'path'
import { randomBytes } from 'crypto'
import { ActivityPubActorType } from '../../shared/models/activitypub'
import { FollowState } from '../../shared/models/actors'
import {
  AbuseState,
  VideoImportState,
  VideoPrivacy,
  VideoTranscodingFPS,
  JobType,
  VideoRateType,
  VideoResolution,
  VideoState
} from '../../shared/models'
// Do not use barrels, remain constants as independent as possible
import { isTestInstance, sanitizeHost, sanitizeUrl, root } from '../helpers/core-utils'
import { NSFWPolicyType } from '../../shared/models/videos/nsfw-policy.type'
import { invert } from 'lodash'
import { CronRepeatOptions, EveryRepeatOptions } from 'bull'
import { VideoPlaylistPrivacy } from '../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylistType } from '../../shared/models/videos/playlist/video-playlist-type.model'
import { CONFIG, registerConfigChangedHandler } from './config'

// ---------------------------------------------------------------------------

const LAST_MIGRATION_VERSION = 525

// ---------------------------------------------------------------------------

const API_VERSION = 'v1'
const PEERTUBE_VERSION = require(join(root(), 'package.json')).version

const PAGINATION = {
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

const WEBSERVER = {
  URL: '',
  HOST: '',
  SCHEME: '',
  WS: '',
  HOSTNAME: '',
  PORT: 0
}

// Sortable columns per schema
const SORTABLE_COLUMNS = {
  USERS: [ 'id', 'username', 'videoQuotaUsed', 'createdAt', 'lastLoginDate', 'role' ],
  USER_SUBSCRIPTIONS: [ 'id', 'createdAt' ],
  ACCOUNTS: [ 'createdAt' ],
  JOBS: [ 'createdAt' ],
  VIDEO_CHANNELS: [ 'id', 'name', 'updatedAt', 'createdAt' ],
  VIDEO_IMPORTS: [ 'createdAt' ],
  VIDEO_COMMENT_THREADS: [ 'createdAt', 'totalReplies' ],
  VIDEO_RATES: [ 'createdAt' ],
  BLACKLISTS: [ 'id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt' ],
  FOLLOWERS: [ 'createdAt', 'state', 'score' ],
  FOLLOWING: [ 'createdAt', 'redundancyAllowed', 'state' ],

  VIDEOS: [ 'name', 'duration', 'createdAt', 'publishedAt', 'originallyPublishedAt', 'views', 'likes', 'trending' ],

  // Don't forget to update peertube-search-index with the same values
  VIDEOS_SEARCH: [ 'name', 'duration', 'createdAt', 'publishedAt', 'originallyPublishedAt', 'views', 'likes', 'match' ],
  VIDEO_CHANNELS_SEARCH: [ 'match', 'displayName', 'createdAt' ],

  ABUSES: [ 'id', 'createdAt', 'state' ],

  ACCOUNTS_BLOCKLIST: [ 'createdAt' ],
  SERVERS_BLOCKLIST: [ 'createdAt' ],

  USER_NOTIFICATIONS: [ 'createdAt', 'read' ],

  VIDEO_PLAYLISTS: [ 'displayName', 'createdAt', 'updatedAt' ],

  PLUGINS: [ 'name', 'createdAt', 'updatedAt' ],

  AVAILABLE_PLUGINS: [ 'npmName', 'popularity' ],

  VIDEO_REDUNDANCIES: [ 'name' ]
}

const OAUTH_LIFETIME = {
  ACCESS_TOKEN: 3600 * 24, // 1 day, for upload
  REFRESH_TOKEN: 1209600 // 2 weeks
}

const ROUTE_CACHE_LIFETIME = {
  FEEDS: '15 minutes',
  ROBOTS: '2 hours',
  SITEMAP: '1 day',
  SECURITYTXT: '2 hours',
  NODEINFO: '10 minutes',
  DNT_POLICY: '1 week',
  ACTIVITY_PUB: {
    VIDEOS: '1 second' // 1 second, cache concurrent requests after a broadcast for example
  },
  STATS: '4 hours'
}

// ---------------------------------------------------------------------------

// Number of points we add/remove after a successful/bad request
const ACTOR_FOLLOW_SCORE = {
  PENALTY: -10,
  BONUS: 10,
  BASE: 1000,
  MAX: 10000
}

const FOLLOW_STATES: { [ id: string ]: FollowState } = {
  PENDING: 'pending',
  ACCEPTED: 'accepted'
}

const REMOTE_SCHEME = {
  HTTP: 'https',
  WS: 'wss'
}

const JOB_ATTEMPTS: { [id in JobType]: number } = {
  'activitypub-http-broadcast': 5,
  'activitypub-http-unicast': 5,
  'activitypub-http-fetcher': 5,
  'activitypub-follow': 5,
  'video-file-import': 1,
  'video-transcoding': 1,
  'video-import': 1,
  'email': 5,
  'videos-views': 1,
  'activitypub-refresher': 1,
  'video-redundancy': 1
}
const JOB_CONCURRENCY: { [id in JobType]: number } = {
  'activitypub-http-broadcast': 1,
  'activitypub-http-unicast': 5,
  'activitypub-http-fetcher': 1,
  'activitypub-follow': 1,
  'video-file-import': 1,
  'video-transcoding': 1,
  'video-import': 1,
  'email': 5,
  'videos-views': 1,
  'activitypub-refresher': 1,
  'video-redundancy': 1
}
const JOB_TTL: { [id in JobType]: number } = {
  'activitypub-http-broadcast': 60000 * 10, // 10 minutes
  'activitypub-http-unicast': 60000 * 10, // 10 minutes
  'activitypub-http-fetcher': 1000 * 3600 * 10, // 10 hours
  'activitypub-follow': 60000 * 10, // 10 minutes
  'video-file-import': 1000 * 3600, // 1 hour
  'video-transcoding': 1000 * 3600 * 48, // 2 days, transcoding could be long
  'video-import': 1000 * 3600 * 2, // 2 hours
  'email': 60000 * 10, // 10 minutes
  'videos-views': undefined, // Unlimited
  'activitypub-refresher': 60000 * 10, // 10 minutes
  'video-redundancy': 1000 * 3600 * 3 // 3 hours
}
const REPEAT_JOBS: { [ id: string ]: EveryRepeatOptions | CronRepeatOptions } = {
  'videos-views': {
    cron: '1 * * * *' // At 1 minute past the hour
  }
}

const BROADCAST_CONCURRENCY = 10 // How many requests in parallel we do in activitypub-http-broadcast job
const CRAWL_REQUEST_CONCURRENCY = 1 // How many requests in parallel to fetch remote data (likes, shares...)
const JOB_REQUEST_TIMEOUT = 3000 // 3 seconds
const JOB_COMPLETED_LIFETIME = 60000 * 60 * 24 * 2 // 2 days
const VIDEO_IMPORT_TIMEOUT = 1000 * 3600 // 1 hour

const SCHEDULER_INTERVALS_MS = {
  actorFollowScores: 60000 * 60, // 1 hour
  removeOldJobs: 60000 * 60, // 1 hour
  updateVideos: 60000, // 1 minute
  youtubeDLUpdate: 60000 * 60 * 24, // 1 day
  checkPlugins: CONFIG.PLUGINS.INDEX.CHECK_LATEST_VERSIONS_INTERVAL,
  autoFollowIndexInstances: 60000 * 60 * 24, // 1 day
  removeOldViews: 60000 * 60 * 24, // 1 day
  removeOldHistory: 60000 * 60 * 24 // 1 day
}

// ---------------------------------------------------------------------------

const CONSTRAINTS_FIELDS = {
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
  VIDEO_BLACKLIST: {
    REASON: { min: 2, max: 300 } // Length
  },
  VIDEO_CHANNELS: {
    NAME: { min: 1, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 1000 }, // Length
    SUPPORT: { min: 3, max: 1000 }, // Length
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_CAPTIONS: {
    CAPTION_FILE: {
      EXTNAME: [ '.vtt', '.srt' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
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
      EXTNAME: [ '.jpg', '.jpeg' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
      }
    },
    EXTNAME: [] as string[],
    INFO_HASH: { min: 40, max: 40 }, // Length, info hash is 20 bytes length but we represent it in hexadecimal so 20 * 2
    DURATION: { min: 0 }, // Number
    TAGS: { min: 0, max: 5 }, // Number of total tags
    TAG: { min: 2, max: 30 }, // Length
    THUMBNAIL: { min: 2, max: 30 },
    THUMBNAIL_DATA: { min: 0, max: 20000 }, // Bytes
    VIEWS: { min: 0 },
    LIKES: { min: 0 },
    DISLIKES: { min: 0 },
    FILE_SIZE: { min: 10 },
    URL: { min: 3, max: 2000 } // Length
  },
  VIDEO_PLAYLISTS: {
    NAME: { min: 1, max: 120 }, // Length
    DESCRIPTION: { min: 3, max: 1000 }, // Length
    URL: { min: 3, max: 2000 }, // Length
    IMAGE: {
      EXTNAME: [ '.jpg', '.jpeg' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
      }
    }
  },
  ACTORS: {
    PUBLIC_KEY: { min: 10, max: 5000 }, // Length
    PRIVATE_KEY: { min: 10, max: 5000 }, // Length
    URL: { min: 3, max: 2000 }, // Length
    AVATAR: {
      EXTNAME: [ '.png', '.jpeg', '.jpg' ],
      FILE_SIZE: {
        max: 2 * 1024 * 1024 // 2MB
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
  }
}

let VIDEO_VIEW_LIFETIME = 60000 * 60 // 1 hour
let CONTACT_FORM_LIFETIME = 60000 * 60 // 1 hour

const VIDEO_TRANSCODING_FPS: VideoTranscodingFPS = {
  MIN: 10,
  STANDARD: [ 24, 25, 30 ],
  HD_STANDARD: [ 50, 60 ],
  AVERAGE: 30,
  MAX: 60,
  KEEP_ORIGIN_FPS_RESOLUTION_MIN: 720 // We keep the original FPS on high resolutions (720 minimum)
}

const DEFAULT_AUDIO_RESOLUTION = VideoResolution.H_480P

const VIDEO_RATE_TYPES: { [ id: string ]: VideoRateType } = {
  LIKE: 'like',
  DISLIKE: 'dislike'
}

const FFMPEG_NICE: { [ id: string ]: number } = {
  THUMBNAIL: 2, // 2 just for don't blocking servers
  TRANSCODING: 15
}

const VIDEO_CATEGORIES = {
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
const VIDEO_LICENCES = {
  1: 'Attribution',
  2: 'Attribution - Share Alike',
  3: 'Attribution - No Derivatives',
  4: 'Attribution - Non Commercial',
  5: 'Attribution - Non Commercial - Share Alike',
  6: 'Attribution - Non Commercial - No Derivatives',
  7: 'Public Domain Dedication'
}

const VIDEO_LANGUAGES: { [id: string]: string } = {}

const VIDEO_PRIVACIES = {
  [VideoPrivacy.PUBLIC]: 'Public',
  [VideoPrivacy.UNLISTED]: 'Unlisted',
  [VideoPrivacy.PRIVATE]: 'Private',
  [VideoPrivacy.INTERNAL]: 'Internal'
}

const VIDEO_STATES = {
  [VideoState.PUBLISHED]: 'Published',
  [VideoState.TO_TRANSCODE]: 'To transcode',
  [VideoState.TO_IMPORT]: 'To import'
}

const VIDEO_IMPORT_STATES = {
  [VideoImportState.FAILED]: 'Failed',
  [VideoImportState.PENDING]: 'Pending',
  [VideoImportState.SUCCESS]: 'Success',
  [VideoImportState.REJECTED]: 'Rejected'
}

const ABUSE_STATES = {
  [AbuseState.PENDING]: 'Pending',
  [AbuseState.REJECTED]: 'Rejected',
  [AbuseState.ACCEPTED]: 'Accepted'
}

const VIDEO_PLAYLIST_PRIVACIES = {
  [VideoPlaylistPrivacy.PUBLIC]: 'Public',
  [VideoPlaylistPrivacy.UNLISTED]: 'Unlisted',
  [VideoPlaylistPrivacy.PRIVATE]: 'Private'
}

const VIDEO_PLAYLIST_TYPES = {
  [VideoPlaylistType.REGULAR]: 'Regular',
  [VideoPlaylistType.WATCH_LATER]: 'Watch later'
}

const MIMETYPES = {
  AUDIO: {
    MIMETYPE_EXT: {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'application/ogg': '.ogg',
      'audio/ogg': '.ogg',
      'audio/x-ms-wma': '.wma',
      'audio/wav': '.wav',
      'audio/x-flac': '.flac',
      'audio/flac': '.flac'
    },
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  VIDEO: {
    MIMETYPE_EXT: null as { [ id: string ]: string },
    EXT_MIMETYPE: null as { [ id: string ]: string }
  },
  IMAGE: {
    MIMETYPE_EXT: {
      'image/png': '.png',
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
    }
  },
  TORRENT: {
    MIMETYPE_EXT: {
      'application/x-bittorrent': '.torrent'
    }
  }
}
MIMETYPES.AUDIO.EXT_MIMETYPE = invert(MIMETYPES.AUDIO.MIMETYPE_EXT)
MIMETYPES.IMAGE.EXT_MIMETYPE = invert(MIMETYPES.IMAGE.MIMETYPE_EXT)

// ---------------------------------------------------------------------------

const OVERVIEWS = {
  VIDEOS: {
    SAMPLE_THRESHOLD: 6,
    SAMPLES_COUNT: 20
  }
}

const VIDEO_CHANNELS = {
  MAX_PER_USER: 20
}

// ---------------------------------------------------------------------------

const SERVER_ACTOR_NAME = 'peertube'

const ACTIVITY_PUB = {
  POTENTIAL_ACCEPT_HEADERS: [
    'application/activity+json',
    'application/ld+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  ],
  ACCEPT_HEADER: 'application/activity+json, application/ld+json',
  PUBLIC: 'https://www.w3.org/ns/activitystreams#Public',
  COLLECTION_ITEMS_PER_PAGE: 10,
  FETCH_PAGE_LIMIT: 2000,
  URL_MIME_TYPES: {
    VIDEO: [] as string[],
    TORRENT: [ 'application/x-bittorrent' ],
    MAGNET: [ 'application/x-bittorrent;x-scheme-handler/magnet' ]
  },
  MAX_RECURSION_COMMENTS: 100,
  ACTOR_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2, // 2 days
  VIDEO_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2, // 2 days
  VIDEO_PLAYLIST_REFRESH_INTERVAL: 3600 * 24 * 1000 * 2 // 2 days
}

const ACTIVITY_PUB_ACTOR_TYPES: { [ id: string ]: ActivityPubActorType } = {
  GROUP: 'Group',
  PERSON: 'Person',
  APPLICATION: 'Application',
  ORGANIZATION: 'Organization',
  SERVICE: 'Service'
}

const HTTP_SIGNATURE = {
  HEADER_NAME: 'signature',
  ALGORITHM: 'rsa-sha256',
  HEADERS_TO_SIGN: [ '(request-target)', 'host', 'date', 'digest' ],
  CLOCK_SKEW_SECONDS: 1800
}

// ---------------------------------------------------------------------------

let PRIVATE_RSA_KEY_SIZE = 2048

// Password encryption
const BCRYPT_SALT_SIZE = 10

const USER_PASSWORD_RESET_LIFETIME = 60000 * 60 // 60 minutes
const USER_PASSWORD_CREATE_LIFETIME = 60000 * 60 * 24 * 7 // 7 days

const USER_EMAIL_VERIFY_LIFETIME = 60000 * 60 // 60 minutes

const NSFW_POLICY_TYPES: { [ id: string ]: NSFWPolicyType } = {
  DO_NOT_LIST: 'do_not_list',
  BLUR: 'blur',
  DISPLAY: 'display'
}

// ---------------------------------------------------------------------------

// Express static paths (router)
const STATIC_PATHS = {
  PREVIEWS: '/static/previews/',
  THUMBNAILS: '/static/thumbnails/',
  TORRENTS: '/static/torrents/',
  WEBSEED: '/static/webseed/',
  REDUNDANCY: '/static/redundancy/',
  STREAMING_PLAYLISTS: {
    HLS: '/static/streaming-playlists/hls'
  },
  AVATARS: '/static/avatars/',
  VIDEO_CAPTIONS: '/static/video-captions/'
}
const STATIC_DOWNLOAD_PATHS = {
  TORRENTS: '/download/torrents/',
  VIDEOS: '/download/videos/',
  HLS_VIDEOS: '/download/streaming-playlists/hls/videos/'
}
const LAZY_STATIC_PATHS = {
  AVATARS: '/lazy-static/avatars/',
  PREVIEWS: '/static/previews/',
  VIDEO_CAPTIONS: '/static/video-captions/'
}

// Cache control
const STATIC_MAX_AGE = {
  SERVER: '2h',
  CLIENT: '30d'
}

// Videos thumbnail size
const THUMBNAILS_SIZE = {
  width: 223,
  height: 122,
  minWidth: 150
}
const PREVIEWS_SIZE = {
  width: 850,
  height: 480,
  minWidth: 400
}
const AVATARS_SIZE = {
  width: 120,
  height: 120
}

const EMBED_SIZE = {
  width: 560,
  height: 315
}

// Sub folders of cache directory
const FILES_CACHE = {
  PREVIEWS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'previews'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  },
  VIDEO_CAPTIONS: {
    DIRECTORY: join(CONFIG.STORAGE.CACHE_DIR, 'video-captions'),
    MAX_AGE: 1000 * 3600 * 3 // 3 hours
  }
}

const LRU_CACHE = {
  USER_TOKENS: {
    MAX_SIZE: 1000
  },
  AVATAR_STATIC: {
    MAX_SIZE: 500
  }
}

const HLS_STREAMING_PLAYLIST_DIRECTORY = join(CONFIG.STORAGE.STREAMING_PLAYLISTS_DIR, 'hls')
const HLS_REDUNDANCY_DIRECTORY = join(CONFIG.STORAGE.REDUNDANCY_DIR, 'hls')

const MEMOIZE_TTL = {
  OVERVIEWS_SAMPLE: 1000 * 3600 * 4, // 4 hours
  INFO_HASH_EXISTS: 1000 * 3600 * 12 // 12 hours
}

const MEMOIZE_LENGTH = {
  INFO_HASH_EXISTS: 200
}

const QUEUE_CONCURRENCY = {
  AVATAR_PROCESS_IMAGE: 3
}

const REDUNDANCY = {
  VIDEOS: {
    RANDOMIZED_FACTOR: 5
  }
}

const ACCEPT_HEADERS = [ 'html', 'application/json' ].concat(ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS)

const ASSETS_PATH = {
  DEFAULT_AUDIO_BACKGROUND: join(root(), 'dist', 'server', 'assets', 'default-audio-background.jpg')
}

// ---------------------------------------------------------------------------

const CUSTOM_HTML_TAG_COMMENTS = {
  TITLE: '<!-- title tag -->',
  DESCRIPTION: '<!-- description tag -->',
  CUSTOM_CSS: '<!-- custom css tag -->',
  META_TAGS: '<!-- meta tags -->'
}

// ---------------------------------------------------------------------------

const FEEDS = {
  COUNT: 20
}

const MAX_LOGS_OUTPUT_CHARACTERS = 10 * 1000 * 1000
const LOG_FILENAME = 'peertube.log'
const AUDIT_LOG_FILENAME = 'peertube-audit.log'

// ---------------------------------------------------------------------------

const TRACKER_RATE_LIMITS = {
  INTERVAL: 60000 * 5, // 5 minutes
  ANNOUNCES_PER_IP_PER_INFOHASH: 15, // maximum announces per torrent in the interval
  ANNOUNCES_PER_IP: 30, // maximum announces for all our torrents in the interval
  BLOCK_IP_LIFETIME: 60000 * 10 // 10 minutes
}

const P2P_MEDIA_LOADER_PEER_VERSION = 2

// ---------------------------------------------------------------------------

const PLUGIN_GLOBAL_CSS_FILE_NAME = 'plugins-global.css'
const PLUGIN_GLOBAL_CSS_PATH = join(CONFIG.STORAGE.TMP_DIR, PLUGIN_GLOBAL_CSS_FILE_NAME)

let PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME = 1000 * 60 * 5 // 5 minutes

const DEFAULT_THEME_NAME = 'default'
const DEFAULT_USER_THEME_NAME = 'instance-default'

// ---------------------------------------------------------------------------

const SEARCH_INDEX = {
  ROUTES: {
    VIDEOS: '/api/v1/search/videos',
    VIDEO_CHANNELS: '/api/v1/search/video-channels'
  }
}

// ---------------------------------------------------------------------------

// Special constants for a test instance
if (isTestInstance() === true) {
  PRIVATE_RSA_KEY_SIZE = 1024

  ACTOR_FOLLOW_SCORE.BASE = 20

  REMOTE_SCHEME.HTTP = 'http'
  REMOTE_SCHEME.WS = 'ws'

  STATIC_MAX_AGE.SERVER = '0'

  ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE = 2
  ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL = 10 * 1000 // 10 seconds
  ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL = 10 * 1000 // 10 seconds
  ACTIVITY_PUB.VIDEO_PLAYLIST_REFRESH_INTERVAL = 10 * 1000 // 10 seconds

  CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max = 100 * 1024 // 100KB

  SCHEDULER_INTERVALS_MS.actorFollowScores = 1000
  SCHEDULER_INTERVALS_MS.removeOldJobs = 10000
  SCHEDULER_INTERVALS_MS.removeOldHistory = 5000
  SCHEDULER_INTERVALS_MS.removeOldViews = 5000
  SCHEDULER_INTERVALS_MS.updateVideos = 5000
  SCHEDULER_INTERVALS_MS.autoFollowIndexInstances = 5000
  REPEAT_JOBS['videos-views'] = { every: 5000 }

  REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR = 1

  VIDEO_VIEW_LIFETIME = 1000 // 1 second
  CONTACT_FORM_LIFETIME = 1000 // 1 second

  JOB_ATTEMPTS['email'] = 1

  FILES_CACHE.VIDEO_CAPTIONS.MAX_AGE = 3000
  MEMOIZE_TTL.OVERVIEWS_SAMPLE = 3000
  OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD = 2

  PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME = 5000
}

updateWebserverUrls()
updateWebserverConfig()

registerConfigChangedHandler(() => {
  updateWebserverUrls()
  updateWebserverConfig()
})

// ---------------------------------------------------------------------------

const FILES_CONTENT_HASH = {
  MANIFEST: generateContentHash(),
  FAVICON: generateContentHash(),
  LOGO: generateContentHash()
}

// ---------------------------------------------------------------------------

export {
  WEBSERVER,
  API_VERSION,
  PEERTUBE_VERSION,
  LAZY_STATIC_PATHS,
  SEARCH_INDEX,
  HLS_REDUNDANCY_DIRECTORY,
  P2P_MEDIA_LOADER_PEER_VERSION,
  AVATARS_SIZE,
  ACCEPT_HEADERS,
  BCRYPT_SALT_SIZE,
  TRACKER_RATE_LIMITS,
  FILES_CACHE,
  LOG_FILENAME,
  CONSTRAINTS_FIELDS,
  EMBED_SIZE,
  REDUNDANCY,
  JOB_CONCURRENCY,
  JOB_ATTEMPTS,
  LAST_MIGRATION_VERSION,
  OAUTH_LIFETIME,
  CUSTOM_HTML_TAG_COMMENTS,
  BROADCAST_CONCURRENCY,
  AUDIT_LOG_FILENAME,
  PAGINATION,
  ACTOR_FOLLOW_SCORE,
  PREVIEWS_SIZE,
  REMOTE_SCHEME,
  FOLLOW_STATES,
  DEFAULT_USER_THEME_NAME,
  SERVER_ACTOR_NAME,
  PLUGIN_GLOBAL_CSS_FILE_NAME,
  PLUGIN_GLOBAL_CSS_PATH,
  PRIVATE_RSA_KEY_SIZE,
  ROUTE_CACHE_LIFETIME,
  SORTABLE_COLUMNS,
  HLS_STREAMING_PLAYLIST_DIRECTORY,
  FEEDS,
  JOB_TTL,
  DEFAULT_THEME_NAME,
  NSFW_POLICY_TYPES,
  STATIC_MAX_AGE,
  STATIC_PATHS,
  VIDEO_IMPORT_TIMEOUT,
  VIDEO_PLAYLIST_TYPES,
  MAX_LOGS_OUTPUT_CHARACTERS,
  ACTIVITY_PUB,
  ACTIVITY_PUB_ACTOR_TYPES,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  MEMOIZE_LENGTH,
  VIDEO_LANGUAGES,
  VIDEO_PRIVACIES,
  VIDEO_LICENCES,
  VIDEO_STATES,
  QUEUE_CONCURRENCY,
  VIDEO_RATE_TYPES,
  VIDEO_TRANSCODING_FPS,
  FFMPEG_NICE,
  ABUSE_STATES,
  VIDEO_CHANNELS,
  LRU_CACHE,
  JOB_REQUEST_TIMEOUT,
  USER_PASSWORD_RESET_LIFETIME,
  USER_PASSWORD_CREATE_LIFETIME,
  MEMOIZE_TTL,
  USER_EMAIL_VERIFY_LIFETIME,
  OVERVIEWS,
  SCHEDULER_INTERVALS_MS,
  REPEAT_JOBS,
  STATIC_DOWNLOAD_PATHS,
  MIMETYPES,
  CRAWL_REQUEST_CONCURRENCY,
  DEFAULT_AUDIO_RESOLUTION,
  JOB_COMPLETED_LIFETIME,
  HTTP_SIGNATURE,
  VIDEO_IMPORT_STATES,
  VIDEO_VIEW_LIFETIME,
  CONTACT_FORM_LIFETIME,
  VIDEO_PLAYLIST_PRIVACIES,
  PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME,
  ASSETS_PATH,
  FILES_CONTENT_HASH,
  loadLanguages,
  buildLanguages,
  generateContentHash
}

// ---------------------------------------------------------------------------

function buildVideoMimetypeExt () {
  const data = {
    // streamable formats that warrant cross-browser compatibility
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/mp4': '.mp4'
  }

  if (CONFIG.TRANSCODING.ENABLED) {
    if (CONFIG.TRANSCODING.ALLOW_ADDITIONAL_EXTENSIONS) {
      Object.assign(data, {
        'video/x-matroska': '.mkv',
        'video/ogg': '.ogg',

        // Developed by Apple
        'video/quicktime': '.mov', // often used as output format by editing software
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
        'video/3gpp': '.3gp',
        'video/3gpp2': '.3g2',

        // Developed by FFmpeg/Mplayer
        'application/x-nut': '.nut',

        // The standard video format used by many Sony and Panasonic HD camcorders.
        // It is also used for storing high definition video on Blu-ray discs.
        'video/mp2t': '.mts',
        'video/m2ts': '.m2ts',

        // Old formats reliant on MPEG-1/MPEG-2
        'video/mpv': '.mpv',
        'video/mpeg2': '.m2v',
        'video/mpeg': '.mpeg',

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
  WEBSERVER.SCHEME = CONFIG.WEBSERVER.SCHEME
  WEBSERVER.WS = CONFIG.WEBSERVER.WS
  WEBSERVER.HOSTNAME = CONFIG.WEBSERVER.HOSTNAME
  WEBSERVER.PORT = CONFIG.WEBSERVER.PORT
}

function updateWebserverConfig () {
  MIMETYPES.VIDEO.MIMETYPE_EXT = buildVideoMimetypeExt()
  MIMETYPES.VIDEO.EXT_MIMETYPE = invert(MIMETYPES.VIDEO.MIMETYPE_EXT)
  ACTIVITY_PUB.URL_MIME_TYPES.VIDEO = Object.keys(MIMETYPES.VIDEO.MIMETYPE_EXT)

  CONSTRAINTS_FIELDS.VIDEOS.EXTNAME = buildVideosExtname()
}

function buildVideosExtname () {
  return Object.keys(MIMETYPES.VIDEO.EXT_MIMETYPE).filter(e => e !== 'null')
}

function loadLanguages () {
  Object.assign(VIDEO_LANGUAGES, buildLanguages())
}

function buildLanguages () {
  const iso639 = require('iso-639-3')

  const languages: { [id: string]: string } = {}

  const additionalLanguages = {
    sgn: true, // Sign languages (macro language)
    ase: true, // American sign language
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
    rsl: true, // Russian sign language: true

    epo: true, // Esperanto
    tlh: true, // Klingon
    jbo: true, // Lojban
    avk: true // Kotava
  }

  // Only add ISO639-1 languages and some sign languages (ISO639-3)
  iso639
    .filter(l => {
      return (l.iso6391 !== undefined && l.type === 'living') ||
        additionalLanguages[l.iso6393] === true
    })
    .forEach(l => { languages[l.iso6391 || l.iso6393] = l.name })

  // Override Occitan label
  languages['oc'] = 'Occitan'
  languages['el'] = 'Greek'

  return languages
}

function generateContentHash () {
  return randomBytes(20).toString('hex')
}
