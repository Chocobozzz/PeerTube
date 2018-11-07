"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const models_1 = require("../../shared/models");
const videos_1 = require("../../shared/models/videos");
const core_utils_1 = require("../helpers/core-utils");
const lodash_1 = require("lodash");
const bytes = require("bytes");
let config = require('config');
const LAST_MIGRATION_VERSION = 285;
exports.LAST_MIGRATION_VERSION = LAST_MIGRATION_VERSION;
const API_VERSION = 'v1';
exports.API_VERSION = API_VERSION;
const PAGINATION = {
    COUNT: {
        DEFAULT: 15,
        MAX: 100
    }
};
exports.PAGINATION = PAGINATION;
const SORTABLE_COLUMNS = {
    USERS: ['id', 'username', 'createdAt'],
    USER_SUBSCRIPTIONS: ['id', 'createdAt'],
    ACCOUNTS: ['createdAt'],
    JOBS: ['createdAt'],
    VIDEO_ABUSES: ['id', 'createdAt', 'state'],
    VIDEO_CHANNELS: ['id', 'name', 'updatedAt', 'createdAt'],
    VIDEO_IMPORTS: ['createdAt'],
    VIDEO_COMMENT_THREADS: ['createdAt'],
    BLACKLISTS: ['id', 'name', 'duration', 'views', 'likes', 'dislikes', 'uuid', 'createdAt'],
    FOLLOWERS: ['createdAt'],
    FOLLOWING: ['createdAt'],
    VIDEOS: ['name', 'duration', 'createdAt', 'publishedAt', 'views', 'likes', 'trending'],
    VIDEOS_SEARCH: ['name', 'duration', 'createdAt', 'publishedAt', 'views', 'likes', 'match'],
    VIDEO_CHANNELS_SEARCH: ['match', 'displayName', 'createdAt'],
    ACCOUNTS_BLOCKLIST: ['createdAt'],
    SERVERS_BLOCKLIST: ['createdAt']
};
exports.SORTABLE_COLUMNS = SORTABLE_COLUMNS;
const OAUTH_LIFETIME = {
    ACCESS_TOKEN: 3600 * 24,
    REFRESH_TOKEN: 1209600
};
exports.OAUTH_LIFETIME = OAUTH_LIFETIME;
const ROUTE_CACHE_LIFETIME = {
    FEEDS: '15 minutes',
    ROBOTS: '2 hours',
    SECURITYTXT: '2 hours',
    NODEINFO: '10 minutes',
    DNT_POLICY: '1 week',
    OVERVIEWS: {
        VIDEOS: '1 hour'
    },
    ACTIVITY_PUB: {
        VIDEOS: '1 second'
    },
    STATS: '4 hours'
};
exports.ROUTE_CACHE_LIFETIME = ROUTE_CACHE_LIFETIME;
const ACTOR_FOLLOW_SCORE = {
    PENALTY: -10,
    BONUS: 10,
    BASE: 1000,
    MAX: 10000
};
exports.ACTOR_FOLLOW_SCORE = ACTOR_FOLLOW_SCORE;
const FOLLOW_STATES = {
    PENDING: 'pending',
    ACCEPTED: 'accepted'
};
exports.FOLLOW_STATES = FOLLOW_STATES;
const REMOTE_SCHEME = {
    HTTP: 'https',
    WS: 'wss'
};
exports.REMOTE_SCHEME = REMOTE_SCHEME;
const JOB_ATTEMPTS = {
    'activitypub-http-broadcast': 5,
    'activitypub-http-unicast': 5,
    'activitypub-http-fetcher': 5,
    'activitypub-follow': 5,
    'video-file-import': 1,
    'video-file': 1,
    'video-import': 1,
    'email': 5,
    'videos-views': 1
};
exports.JOB_ATTEMPTS = JOB_ATTEMPTS;
const JOB_CONCURRENCY = {
    'activitypub-http-broadcast': 1,
    'activitypub-http-unicast': 5,
    'activitypub-http-fetcher': 1,
    'activitypub-follow': 3,
    'video-file-import': 1,
    'video-file': 1,
    'video-import': 1,
    'email': 5,
    'videos-views': 1
};
exports.JOB_CONCURRENCY = JOB_CONCURRENCY;
const JOB_TTL = {
    'activitypub-http-broadcast': 60000 * 10,
    'activitypub-http-unicast': 60000 * 10,
    'activitypub-http-fetcher': 60000 * 10,
    'activitypub-follow': 60000 * 10,
    'video-file-import': 1000 * 3600,
    'video-file': 1000 * 3600 * 48,
    'video-import': 1000 * 3600 * 2,
    'email': 60000 * 10,
    'videos-views': undefined
};
exports.JOB_TTL = JOB_TTL;
const REPEAT_JOBS = {
    'videos-views': {
        cron: '1 * * * *'
    }
};
exports.REPEAT_JOBS = REPEAT_JOBS;
const BROADCAST_CONCURRENCY = 10;
exports.BROADCAST_CONCURRENCY = BROADCAST_CONCURRENCY;
const CRAWL_REQUEST_CONCURRENCY = 1;
exports.CRAWL_REQUEST_CONCURRENCY = CRAWL_REQUEST_CONCURRENCY;
const JOB_REQUEST_TIMEOUT = 3000;
exports.JOB_REQUEST_TIMEOUT = JOB_REQUEST_TIMEOUT;
const JOB_COMPLETED_LIFETIME = 60000 * 60 * 24 * 2;
exports.JOB_COMPLETED_LIFETIME = JOB_COMPLETED_LIFETIME;
const VIDEO_IMPORT_TIMEOUT = 1000 * 3600;
exports.VIDEO_IMPORT_TIMEOUT = VIDEO_IMPORT_TIMEOUT;
let SCHEDULER_INTERVALS_MS = {
    badActorFollow: 60000 * 60,
    removeOldJobs: 60000 * 60,
    updateVideos: 60000,
    youtubeDLUpdate: 60000 * 60 * 24
};
exports.SCHEDULER_INTERVALS_MS = SCHEDULER_INTERVALS_MS;
const CONFIG = {
    CUSTOM_FILE: getLocalConfigFilePath(),
    LISTEN: {
        PORT: config.get('listen.port'),
        HOSTNAME: config.get('listen.hostname')
    },
    DATABASE: {
        DBNAME: 'peertube' + config.get('database.suffix'),
        HOSTNAME: config.get('database.hostname'),
        PORT: config.get('database.port'),
        USERNAME: config.get('database.username'),
        PASSWORD: config.get('database.password'),
        POOL: {
            MAX: config.get('database.pool.max')
        }
    },
    REDIS: {
        HOSTNAME: config.has('redis.hostname') ? config.get('redis.hostname') : null,
        PORT: config.has('redis.port') ? config.get('redis.port') : null,
        SOCKET: config.has('redis.socket') ? config.get('redis.socket') : null,
        AUTH: config.has('redis.auth') ? config.get('redis.auth') : null,
        DB: config.has('redis.db') ? config.get('redis.db') : null
    },
    SMTP: {
        HOSTNAME: config.get('smtp.hostname'),
        PORT: config.get('smtp.port'),
        USERNAME: config.get('smtp.username'),
        PASSWORD: config.get('smtp.password'),
        TLS: config.get('smtp.tls'),
        DISABLE_STARTTLS: config.get('smtp.disable_starttls'),
        CA_FILE: config.get('smtp.ca_file'),
        FROM_ADDRESS: config.get('smtp.from_address')
    },
    STORAGE: {
        AVATARS_DIR: core_utils_1.buildPath(config.get('storage.avatars')),
        LOG_DIR: core_utils_1.buildPath(config.get('storage.logs')),
        VIDEOS_DIR: core_utils_1.buildPath(config.get('storage.videos')),
        THUMBNAILS_DIR: core_utils_1.buildPath(config.get('storage.thumbnails')),
        PREVIEWS_DIR: core_utils_1.buildPath(config.get('storage.previews')),
        CAPTIONS_DIR: core_utils_1.buildPath(config.get('storage.captions')),
        TORRENTS_DIR: core_utils_1.buildPath(config.get('storage.torrents')),
        CACHE_DIR: core_utils_1.buildPath(config.get('storage.cache'))
    },
    WEBSERVER: {
        SCHEME: config.get('webserver.https') === true ? 'https' : 'http',
        WS: config.get('webserver.https') === true ? 'wss' : 'ws',
        HOSTNAME: config.get('webserver.hostname'),
        PORT: config.get('webserver.port'),
        URL: '',
        HOST: ''
    },
    TRUST_PROXY: config.get('trust_proxy'),
    LOG: {
        LEVEL: config.get('log.level')
    },
    SEARCH: {
        REMOTE_URI: {
            USERS: config.get('search.remote_uri.users'),
            ANONYMOUS: config.get('search.remote_uri.anonymous')
        }
    },
    TRENDING: {
        VIDEOS: {
            INTERVAL_DAYS: config.get('trending.videos.interval_days')
        }
    },
    REDUNDANCY: {
        VIDEOS: {
            CHECK_INTERVAL: core_utils_1.parseDuration(config.get('redundancy.videos.check_interval')),
            STRATEGIES: buildVideosRedundancy(config.get('redundancy.videos.strategies'))
        }
    },
    ADMIN: {
        get EMAIL() { return config.get('admin.email'); }
    },
    SIGNUP: {
        get ENABLED() { return config.get('signup.enabled'); },
        get LIMIT() { return config.get('signup.limit'); },
        get REQUIRES_EMAIL_VERIFICATION() { return config.get('signup.requires_email_verification'); },
        FILTERS: {
            CIDR: {
                get WHITELIST() { return config.get('signup.filters.cidr.whitelist'); },
                get BLACKLIST() { return config.get('signup.filters.cidr.blacklist'); }
            }
        }
    },
    USER: {
        get VIDEO_QUOTA() { return core_utils_1.parseBytes(config.get('user.video_quota')); },
        get VIDEO_QUOTA_DAILY() { return core_utils_1.parseBytes(config.get('user.video_quota_daily')); }
    },
    TRANSCODING: {
        get ENABLED() { return config.get('transcoding.enabled'); },
        get THREADS() { return config.get('transcoding.threads'); },
        RESOLUTIONS: {
            get '240p'() { return config.get('transcoding.resolutions.240p'); },
            get '360p'() { return config.get('transcoding.resolutions.360p'); },
            get '480p'() { return config.get('transcoding.resolutions.480p'); },
            get '720p'() { return config.get('transcoding.resolutions.720p'); },
            get '1080p'() { return config.get('transcoding.resolutions.1080p'); }
        }
    },
    IMPORT: {
        VIDEOS: {
            HTTP: {
                get ENABLED() { return config.get('import.videos.http.enabled'); }
            },
            TORRENT: {
                get ENABLED() { return config.get('import.videos.torrent.enabled'); }
            }
        }
    },
    CACHE: {
        PREVIEWS: {
            get SIZE() { return config.get('cache.previews.size'); }
        },
        VIDEO_CAPTIONS: {
            get SIZE() { return config.get('cache.captions.size'); }
        }
    },
    INSTANCE: {
        get NAME() { return config.get('instance.name'); },
        get SHORT_DESCRIPTION() { return config.get('instance.short_description'); },
        get DESCRIPTION() { return config.get('instance.description'); },
        get TERMS() { return config.get('instance.terms'); },
        get DEFAULT_CLIENT_ROUTE() { return config.get('instance.default_client_route'); },
        get DEFAULT_NSFW_POLICY() { return config.get('instance.default_nsfw_policy'); },
        CUSTOMIZATIONS: {
            get JAVASCRIPT() { return config.get('instance.customizations.javascript'); },
            get CSS() { return config.get('instance.customizations.css'); }
        },
        get ROBOTS() { return config.get('instance.robots'); },
        get SECURITYTXT() { return config.get('instance.securitytxt'); },
        get SECURITYTXT_CONTACT() { return config.get('admin.email'); }
    },
    SERVICES: {
        TWITTER: {
            get USERNAME() { return config.get('services.twitter.username'); },
            get WHITELISTED() { return config.get('services.twitter.whitelisted'); }
        }
    }
};
exports.CONFIG = CONFIG;
const CONSTRAINTS_FIELDS = {
    USERS: {
        NAME: { min: 3, max: 120 },
        DESCRIPTION: { min: 3, max: 1000 },
        USERNAME: { min: 3, max: 20 },
        PASSWORD: { min: 6, max: 255 },
        VIDEO_QUOTA: { min: -1 },
        VIDEO_QUOTA_DAILY: { min: -1 },
        BLOCKED_REASON: { min: 3, max: 250 }
    },
    VIDEO_ABUSES: {
        REASON: { min: 2, max: 300 },
        MODERATION_COMMENT: { min: 2, max: 300 }
    },
    VIDEO_BLACKLIST: {
        REASON: { min: 2, max: 300 }
    },
    VIDEO_CHANNELS: {
        NAME: { min: 3, max: 120 },
        DESCRIPTION: { min: 3, max: 1000 },
        SUPPORT: { min: 3, max: 1000 },
        URL: { min: 3, max: 2000 }
    },
    VIDEO_CAPTIONS: {
        CAPTION_FILE: {
            EXTNAME: ['.vtt', '.srt'],
            FILE_SIZE: {
                max: 2 * 1024 * 1024
            }
        }
    },
    VIDEO_IMPORTS: {
        URL: { min: 3, max: 2000 },
        TORRENT_NAME: { min: 3, max: 255 },
        TORRENT_FILE: {
            EXTNAME: ['.torrent'],
            FILE_SIZE: {
                max: 1024 * 200
            }
        }
    },
    VIDEOS_REDUNDANCY: {
        URL: { min: 3, max: 2000 }
    },
    VIDEOS: {
        NAME: { min: 3, max: 120 },
        LANGUAGE: { min: 1, max: 10 },
        TRUNCATED_DESCRIPTION: { min: 3, max: 250 },
        DESCRIPTION: { min: 3, max: 10000 },
        SUPPORT: { min: 3, max: 1000 },
        IMAGE: {
            EXTNAME: ['.jpg', '.jpeg'],
            FILE_SIZE: {
                max: 2 * 1024 * 1024
            }
        },
        EXTNAME: ['.mp4', '.ogv', '.webm'],
        INFO_HASH: { min: 40, max: 40 },
        DURATION: { min: 0 },
        TAGS: { min: 0, max: 5 },
        TAG: { min: 2, max: 30 },
        THUMBNAIL: { min: 2, max: 30 },
        THUMBNAIL_DATA: { min: 0, max: 20000 },
        VIEWS: { min: 0 },
        LIKES: { min: 0 },
        DISLIKES: { min: 0 },
        FILE_SIZE: { min: 10 },
        URL: { min: 3, max: 2000 }
    },
    ACTORS: {
        PUBLIC_KEY: { min: 10, max: 5000 },
        PRIVATE_KEY: { min: 10, max: 5000 },
        URL: { min: 3, max: 2000 },
        AVATAR: {
            EXTNAME: ['.png', '.jpeg', '.jpg'],
            FILE_SIZE: {
                max: 2 * 1024 * 1024
            }
        }
    },
    VIDEO_EVENTS: {
        COUNT: { min: 0 }
    },
    VIDEO_COMMENTS: {
        TEXT: { min: 1, max: 3000 },
        URL: { min: 3, max: 2000 }
    },
    VIDEO_SHARE: {
        URL: { min: 3, max: 2000 }
    }
};
exports.CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS;
const RATES_LIMIT = {
    LOGIN: {
        WINDOW_MS: 5 * 60 * 1000,
        MAX: 15
    },
    ASK_SEND_EMAIL: {
        WINDOW_MS: 5 * 60 * 1000,
        MAX: 3
    }
};
exports.RATES_LIMIT = RATES_LIMIT;
let VIDEO_VIEW_LIFETIME = 60000 * 60;
exports.VIDEO_VIEW_LIFETIME = VIDEO_VIEW_LIFETIME;
const VIDEO_TRANSCODING_FPS = {
    MIN: 10,
    AVERAGE: 30,
    MAX: 60,
    KEEP_ORIGIN_FPS_RESOLUTION_MIN: 720
};
exports.VIDEO_TRANSCODING_FPS = VIDEO_TRANSCODING_FPS;
const VIDEO_RATE_TYPES = {
    LIKE: 'like',
    DISLIKE: 'dislike'
};
exports.VIDEO_RATE_TYPES = VIDEO_RATE_TYPES;
const FFMPEG_NICE = {
    THUMBNAIL: 2,
    TRANSCODING: 15
};
exports.FFMPEG_NICE = FFMPEG_NICE;
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
};
exports.VIDEO_CATEGORIES = VIDEO_CATEGORIES;
const VIDEO_LICENCES = {
    1: 'Attribution',
    2: 'Attribution - Share Alike',
    3: 'Attribution - No Derivatives',
    4: 'Attribution - Non Commercial',
    5: 'Attribution - Non Commercial - Share Alike',
    6: 'Attribution - Non Commercial - No Derivatives',
    7: 'Public Domain Dedication'
};
exports.VIDEO_LICENCES = VIDEO_LICENCES;
const VIDEO_LANGUAGES = buildLanguages();
exports.VIDEO_LANGUAGES = VIDEO_LANGUAGES;
const VIDEO_PRIVACIES = {
    [videos_1.VideoPrivacy.PUBLIC]: 'Public',
    [videos_1.VideoPrivacy.UNLISTED]: 'Unlisted',
    [videos_1.VideoPrivacy.PRIVATE]: 'Private'
};
exports.VIDEO_PRIVACIES = VIDEO_PRIVACIES;
const VIDEO_STATES = {
    [models_1.VideoState.PUBLISHED]: 'Published',
    [models_1.VideoState.TO_TRANSCODE]: 'To transcode',
    [models_1.VideoState.TO_IMPORT]: 'To import'
};
exports.VIDEO_STATES = VIDEO_STATES;
const VIDEO_IMPORT_STATES = {
    [videos_1.VideoImportState.FAILED]: 'Failed',
    [videos_1.VideoImportState.PENDING]: 'Pending',
    [videos_1.VideoImportState.SUCCESS]: 'Success'
};
exports.VIDEO_IMPORT_STATES = VIDEO_IMPORT_STATES;
const VIDEO_ABUSE_STATES = {
    [videos_1.VideoAbuseState.PENDING]: 'Pending',
    [videos_1.VideoAbuseState.REJECTED]: 'Rejected',
    [videos_1.VideoAbuseState.ACCEPTED]: 'Accepted'
};
exports.VIDEO_ABUSE_STATES = VIDEO_ABUSE_STATES;
const VIDEO_MIMETYPE_EXT = {
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/mp4': '.mp4'
};
exports.VIDEO_MIMETYPE_EXT = VIDEO_MIMETYPE_EXT;
const VIDEO_EXT_MIMETYPE = lodash_1.invert(VIDEO_MIMETYPE_EXT);
exports.VIDEO_EXT_MIMETYPE = VIDEO_EXT_MIMETYPE;
const IMAGE_MIMETYPE_EXT = {
    'image/png': '.png',
    'image/jpg': '.jpg',
    'image/jpeg': '.jpg'
};
exports.IMAGE_MIMETYPE_EXT = IMAGE_MIMETYPE_EXT;
const VIDEO_CAPTIONS_MIMETYPE_EXT = {
    'text/vtt': '.vtt',
    'application/x-subrip': '.srt'
};
exports.VIDEO_CAPTIONS_MIMETYPE_EXT = VIDEO_CAPTIONS_MIMETYPE_EXT;
const TORRENT_MIMETYPE_EXT = {
    'application/x-bittorrent': '.torrent'
};
exports.TORRENT_MIMETYPE_EXT = TORRENT_MIMETYPE_EXT;
const OVERVIEWS = {
    VIDEOS: {
        SAMPLE_THRESHOLD: 6,
        SAMPLES_COUNT: 2
    }
};
exports.OVERVIEWS = OVERVIEWS;
const SERVER_ACTOR_NAME = 'peertube';
exports.SERVER_ACTOR_NAME = SERVER_ACTOR_NAME;
const ACTIVITY_PUB = {
    POTENTIAL_ACCEPT_HEADERS: [
        'application/activity+json',
        'application/ld+json',
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
    ],
    ACCEPT_HEADER: 'application/activity+json, application/ld+json',
    PUBLIC: 'https://www.w3.org/ns/activitystreams#Public',
    COLLECTION_ITEMS_PER_PAGE: 10,
    FETCH_PAGE_LIMIT: 100,
    URL_MIME_TYPES: {
        VIDEO: Object.keys(VIDEO_MIMETYPE_EXT),
        TORRENT: ['application/x-bittorrent'],
        MAGNET: ['application/x-bittorrent;x-scheme-handler/magnet']
    },
    MAX_RECURSION_COMMENTS: 100,
    ACTOR_REFRESH_INTERVAL: 3600 * 24 * 1000,
    VIDEO_REFRESH_INTERVAL: 3600 * 24 * 1000
};
exports.ACTIVITY_PUB = ACTIVITY_PUB;
const ACTIVITY_PUB_ACTOR_TYPES = {
    GROUP: 'Group',
    PERSON: 'Person',
    APPLICATION: 'Application'
};
exports.ACTIVITY_PUB_ACTOR_TYPES = ACTIVITY_PUB_ACTOR_TYPES;
const HTTP_SIGNATURE = {
    HEADER_NAME: 'signature',
    ALGORITHM: 'rsa-sha256',
    HEADERS_TO_SIGN: ['date', 'host', 'digest', '(request-target)']
};
exports.HTTP_SIGNATURE = HTTP_SIGNATURE;
const PRIVATE_RSA_KEY_SIZE = 2048;
exports.PRIVATE_RSA_KEY_SIZE = PRIVATE_RSA_KEY_SIZE;
const BCRYPT_SALT_SIZE = 10;
exports.BCRYPT_SALT_SIZE = BCRYPT_SALT_SIZE;
const USER_PASSWORD_RESET_LIFETIME = 60000 * 5;
exports.USER_PASSWORD_RESET_LIFETIME = USER_PASSWORD_RESET_LIFETIME;
const USER_EMAIL_VERIFY_LIFETIME = 60000 * 60;
exports.USER_EMAIL_VERIFY_LIFETIME = USER_EMAIL_VERIFY_LIFETIME;
const NSFW_POLICY_TYPES = {
    DO_NOT_LIST: 'do_not_list',
    BLUR: 'blur',
    DISPLAY: 'display'
};
exports.NSFW_POLICY_TYPES = NSFW_POLICY_TYPES;
const STATIC_PATHS = {
    PREVIEWS: '/static/previews/',
    THUMBNAILS: '/static/thumbnails/',
    TORRENTS: '/static/torrents/',
    WEBSEED: '/static/webseed/',
    AVATARS: '/static/avatars/',
    VIDEO_CAPTIONS: '/static/video-captions/'
};
exports.STATIC_PATHS = STATIC_PATHS;
const STATIC_DOWNLOAD_PATHS = {
    TORRENTS: '/download/torrents/',
    VIDEOS: '/download/videos/'
};
exports.STATIC_DOWNLOAD_PATHS = STATIC_DOWNLOAD_PATHS;
let STATIC_MAX_AGE = '2h';
exports.STATIC_MAX_AGE = STATIC_MAX_AGE;
const THUMBNAILS_SIZE = {
    width: 200,
    height: 110
};
exports.THUMBNAILS_SIZE = THUMBNAILS_SIZE;
const PREVIEWS_SIZE = {
    width: 560,
    height: 315
};
exports.PREVIEWS_SIZE = PREVIEWS_SIZE;
const AVATARS_SIZE = {
    width: 120,
    height: 120
};
exports.AVATARS_SIZE = AVATARS_SIZE;
const EMBED_SIZE = {
    width: 560,
    height: 315
};
exports.EMBED_SIZE = EMBED_SIZE;
const CACHE = {
    PREVIEWS: {
        DIRECTORY: path_1.join(CONFIG.STORAGE.CACHE_DIR, 'previews'),
        MAX_AGE: 1000 * 3600 * 3
    },
    VIDEO_CAPTIONS: {
        DIRECTORY: path_1.join(CONFIG.STORAGE.CACHE_DIR, 'video-captions'),
        MAX_AGE: 1000 * 3600 * 3
    }
};
exports.CACHE = CACHE;
const MEMOIZE_TTL = {
    OVERVIEWS_SAMPLE: 1000 * 3600 * 4
};
exports.MEMOIZE_TTL = MEMOIZE_TTL;
const REDUNDANCY = {
    VIDEOS: {
        RANDOMIZED_FACTOR: 5
    }
};
exports.REDUNDANCY = REDUNDANCY;
const ACCEPT_HEADERS = ['html', 'application/json'].concat(ACTIVITY_PUB.POTENTIAL_ACCEPT_HEADERS);
exports.ACCEPT_HEADERS = ACCEPT_HEADERS;
const CUSTOM_HTML_TAG_COMMENTS = {
    TITLE: '<!-- title tag -->',
    DESCRIPTION: '<!-- description tag -->',
    CUSTOM_CSS: '<!-- custom css tag -->',
    OPENGRAPH_AND_OEMBED: '<!-- open graph and oembed tags -->'
};
exports.CUSTOM_HTML_TAG_COMMENTS = CUSTOM_HTML_TAG_COMMENTS;
const FEEDS = {
    COUNT: 20
};
exports.FEEDS = FEEDS;
const TRACKER_RATE_LIMITS = {
    INTERVAL: 60000 * 5,
    ANNOUNCES_PER_IP_PER_INFOHASH: 15,
    ANNOUNCES_PER_IP: 30
};
exports.TRACKER_RATE_LIMITS = TRACKER_RATE_LIMITS;
if (core_utils_1.isTestInstance() === true) {
    ACTOR_FOLLOW_SCORE.BASE = 20;
    REMOTE_SCHEME.HTTP = 'http';
    REMOTE_SCHEME.WS = 'ws';
    exports.STATIC_MAX_AGE = STATIC_MAX_AGE = '0';
    ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE = 2;
    ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL = 10 * 1000;
    ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL = 10 * 1000;
    CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max = 100 * 1024;
    SCHEDULER_INTERVALS_MS.badActorFollow = 10000;
    SCHEDULER_INTERVALS_MS.removeOldJobs = 10000;
    SCHEDULER_INTERVALS_MS.updateVideos = 5000;
    REPEAT_JOBS['videos-views'] = { every: 5000 };
    REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR = 1;
    exports.VIDEO_VIEW_LIFETIME = VIDEO_VIEW_LIFETIME = 1000;
    JOB_ATTEMPTS['email'] = 1;
    CACHE.VIDEO_CAPTIONS.MAX_AGE = 3000;
    MEMOIZE_TTL.OVERVIEWS_SAMPLE = 1;
    ROUTE_CACHE_LIFETIME.OVERVIEWS.VIDEOS = '0ms';
}
updateWebserverConfig();
function getLocalConfigFilePath() {
    const configSources = config.util.getConfigSources();
    if (configSources.length === 0)
        throw new Error('Invalid config source.');
    let filename = 'local';
    if (process.env.NODE_ENV)
        filename += `-${process.env.NODE_ENV}`;
    if (process.env.NODE_APP_INSTANCE)
        filename += `-${process.env.NODE_APP_INSTANCE}`;
    return path_1.join(path_1.dirname(configSources[0].name), filename + '.json');
}
function updateWebserverConfig() {
    CONFIG.WEBSERVER.URL = core_utils_1.sanitizeUrl(CONFIG.WEBSERVER.SCHEME + '://' + CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT);
    CONFIG.WEBSERVER.HOST = core_utils_1.sanitizeHost(CONFIG.WEBSERVER.HOSTNAME + ':' + CONFIG.WEBSERVER.PORT, REMOTE_SCHEME.HTTP);
}
function buildVideosRedundancy(objs) {
    if (!objs)
        return [];
    return objs.map(obj => {
        return Object.assign(obj, {
            minLifetime: core_utils_1.parseDuration(obj.min_lifetime),
            size: bytes.parse(obj.size),
            minViews: obj.min_views
        });
    });
}
function buildLanguages() {
    const iso639 = require('iso-639-3');
    const languages = {};
    const additionalLanguages = {
        'sgn': true,
        'ase': true,
        'sdl': true,
        'bfi': true,
        'bzs': true,
        'csl': true,
        'cse': true,
        'dsl': true,
        'fsl': true,
        'gsg': true,
        'pks': true,
        'jsl': true,
        'sfs': true,
        'swl': true,
        'rsl': true,
        'epo': true,
        'tlh': true,
        'jbo': true,
        'avk': true
    };
    iso639
        .filter(l => {
        return (l.iso6391 !== null && l.type === 'living') ||
            additionalLanguages[l.iso6393] === true;
    })
        .forEach(l => languages[l.iso6391 || l.iso6393] = l.name);
    languages['oc'] = 'Occitan';
    return languages;
}
exports.buildLanguages = buildLanguages;
function reloadConfig() {
    function directory() {
        if (process.env.NODE_CONFIG_DIR) {
            return process.env.NODE_CONFIG_DIR;
        }
        return path_1.join(core_utils_1.root(), 'config');
    }
    function purge() {
        for (const fileName in require.cache) {
            if (-1 === fileName.indexOf(directory())) {
                continue;
            }
            delete require.cache[fileName];
        }
        delete require.cache[require.resolve('config')];
    }
    purge();
    config = require('config');
    updateWebserverConfig();
}
exports.reloadConfig = reloadConfig;
