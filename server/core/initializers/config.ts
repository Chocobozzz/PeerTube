import bytes from 'bytes'
import { IConfig } from 'config'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import {
  BroadcastMessageLevel,
  NSFWPolicyType,
  VideoCommentPolicyType,
  VideoPrivacyType,
  VideoRedundancyConfigFilter,
  VideosRedundancyStrategy
} from '@peertube/peertube-models'
import { decacheModule } from '@server/helpers/decache.js'
import { buildPath, root } from '@peertube/peertube-node-utils'
import { parseBytes, parseDurationToMs } from '../helpers/core-utils.js'
import { TranscriptionEngineName, WhisperBuiltinModelName } from '@peertube/peertube-transcription'

const require = createRequire(import.meta.url)
let config: IConfig = require('config')

const configChangedHandlers: Function[] = []

const CONFIG = {
  CUSTOM_FILE: getLocalConfigFilePath(),
  LISTEN: {
    PORT: config.get<number>('listen.port'),
    HOSTNAME: config.get<string>('listen.hostname')
  },
  SECRETS: {
    PEERTUBE: config.get<string>('secrets.peertube')
  },
  DATABASE: {
    DBNAME: config.has('database.name') ? config.get<string>('database.name') : 'peertube' + config.get<string>('database.suffix'),
    HOSTNAME: config.get<string>('database.hostname'),
    PORT: config.get<number>('database.port'),
    SSL: config.get<boolean>('database.ssl'),
    USERNAME: config.get<string>('database.username'),
    PASSWORD: config.get<string>('database.password'),
    POOL: {
      MAX: config.get<number>('database.pool.max')
    }
  },
  REDIS: {
    HOSTNAME: config.has('redis.hostname') ? config.get<string>('redis.hostname') : null,
    PORT: config.has('redis.port') ? config.get<number>('redis.port') : null,
    SOCKET: config.has('redis.socket') ? config.get<string>('redis.socket') : null,
    AUTH: config.has('redis.auth') ? config.get<string>('redis.auth') : null,
    DB: config.has('redis.db') ? config.get<number>('redis.db') : null,
    SENTINEL: {
      ENABLED: config.has('redis.sentinel.enabled') ? config.get<boolean>('redis.sentinel.enabled') : false,
      ENABLE_TLS: config.has('redis.sentinel.enable_tls') ? config.get<boolean>('redis.sentinel.enable_tls') : false,
      SENTINELS: config.has('redis.sentinel.sentinels') ? config.get<{ hostname: string, port: number }[]>('redis.sentinel.sentinels') : [],
      MASTER_NAME: config.has('redis.sentinel.master_name') ? config.get<string>('redis.sentinel.master_name') : null
    }
  },
  SMTP: {
    TRANSPORT: config.has('smtp.transport') ? config.get<string>('smtp.transport') : 'smtp',
    SENDMAIL: config.has('smtp.sendmail') ? config.get<string>('smtp.sendmail') : null,
    HOSTNAME: config.get<string>('smtp.hostname'),
    PORT: config.get<number>('smtp.port'),
    USERNAME: config.get<string>('smtp.username'),
    PASSWORD: config.get<string>('smtp.password'),
    TLS: config.get<boolean>('smtp.tls'),
    DISABLE_STARTTLS: config.get<boolean>('smtp.disable_starttls'),
    CA_FILE: config.get<string>('smtp.ca_file'),
    FROM_ADDRESS: config.get<string>('smtp.from_address')
  },
  EMAIL: {
    BODY: {
      SIGNATURE: config.get<string>('email.body.signature')
    },
    SUBJECT: {
      PREFIX: config.get<string>('email.subject.prefix') + ' '
    }
  },

  CLIENT: {
    VIDEOS: {
      MINIATURE: {
        get PREFER_AUTHOR_DISPLAY_NAME () { return config.get<boolean>('client.videos.miniature.prefer_author_display_name') }
      },
      RESUMABLE_UPLOAD: {
        get MAX_CHUNK_SIZE () { return parseBytes(config.get<number>('client.videos.resumable_upload.max_chunk_size') || 0) }
      }
    },
    MENU: {
      LOGIN: {
        get REDIRECT_ON_SINGLE_EXTERNAL_AUTH () { return config.get<boolean>('client.menu.login.redirect_on_single_external_auth') }
      }
    }
  },

  DEFAULTS: {
    PUBLISH: {
      DOWNLOAD_ENABLED: config.get<boolean>('defaults.publish.download_enabled'),
      COMMENTS_POLICY: config.get<VideoCommentPolicyType>('defaults.publish.comments_policy'),
      PRIVACY: config.get<VideoPrivacyType>('defaults.publish.privacy'),
      LICENCE: config.get<number>('defaults.publish.licence')
    },
    P2P: {
      WEBAPP: {
        ENABLED: config.get<boolean>('defaults.p2p.webapp.enabled')
      },
      EMBED: {
        ENABLED: config.get<boolean>('defaults.p2p.embed.enabled')
      }
    },
    PLAYER: {
      get AUTO_PLAY () { return config.get<boolean>('defaults.player.auto_play') }
    }
  },

  STORAGE: {
    TMP_DIR: buildPath(config.get<string>('storage.tmp')),
    TMP_PERSISTENT_DIR: buildPath(config.get<string>('storage.tmp_persistent')),
    BIN_DIR: buildPath(config.get<string>('storage.bin')),
    ACTOR_IMAGES_DIR: buildPath(config.get<string>('storage.avatars')),
    LOG_DIR: buildPath(config.get<string>('storage.logs')),
    WEB_VIDEOS_DIR: buildPath(config.get<string>('storage.web_videos')),
    STREAMING_PLAYLISTS_DIR: buildPath(config.get<string>('storage.streaming_playlists')),
    ORIGINAL_VIDEO_FILES_DIR: buildPath(config.get<string>('storage.original_video_files')),
    REDUNDANCY_DIR: buildPath(config.get<string>('storage.redundancy')),
    THUMBNAILS_DIR: buildPath(config.get<string>('storage.thumbnails')),
    STORYBOARDS_DIR: buildPath(config.get<string>('storage.storyboards')),
    PREVIEWS_DIR: buildPath(config.get<string>('storage.previews')),
    CAPTIONS_DIR: buildPath(config.get<string>('storage.captions')),
    TORRENTS_DIR: buildPath(config.get<string>('storage.torrents')),
    CACHE_DIR: buildPath(config.get<string>('storage.cache')),
    PLUGINS_DIR: buildPath(config.get<string>('storage.plugins')),
    CLIENT_OVERRIDES_DIR: buildPath(config.get<string>('storage.client_overrides')),
    WELL_KNOWN_DIR: buildPath(config.get<string>('storage.well_known'))
  },
  STATIC_FILES: {
    PRIVATE_FILES_REQUIRE_AUTH: config.get<boolean>('static_files.private_files_require_auth')
  },
  OBJECT_STORAGE: {
    ENABLED: config.get<boolean>('object_storage.enabled'),
    MAX_UPLOAD_PART: bytes.parse(config.get<string>('object_storage.max_upload_part')),
    MAX_REQUEST_ATTEMPTS: config.get<number>('object_storage.max_request_attempts'),
    ENDPOINT: config.get<string>('object_storage.endpoint'),
    REGION: config.get<string>('object_storage.region'),
    UPLOAD_ACL: {
      PUBLIC: config.get<string>('object_storage.upload_acl.public'),
      PRIVATE: config.get<string>('object_storage.upload_acl.private')
    },
    CREDENTIALS: {
      ACCESS_KEY_ID: config.get<string>('object_storage.credentials.access_key_id'),
      SECRET_ACCESS_KEY: config.get<string>('object_storage.credentials.secret_access_key')
    },
    PROXY: {
      PROXIFY_PRIVATE_FILES: config.get<boolean>('object_storage.proxy.proxify_private_files')
    },
    WEB_VIDEOS: {
      BUCKET_NAME: config.get<string>('object_storage.web_videos.bucket_name'),
      PREFIX: config.get<string>('object_storage.web_videos.prefix'),
      BASE_URL: config.get<string>('object_storage.web_videos.base_url')
    },
    STREAMING_PLAYLISTS: {
      BUCKET_NAME: config.get<string>('object_storage.streaming_playlists.bucket_name'),
      PREFIX: config.get<string>('object_storage.streaming_playlists.prefix'),
      BASE_URL: config.get<string>('object_storage.streaming_playlists.base_url'),
      STORE_LIVE_STREAMS: config.get<string>('object_storage.streaming_playlists.store_live_streams')
    },
    USER_EXPORTS: {
      BUCKET_NAME: config.get<string>('object_storage.user_exports.bucket_name'),
      PREFIX: config.get<string>('object_storage.user_exports.prefix'),
      BASE_URL: config.get<string>('object_storage.user_exports.base_url')
    },
    ORIGINAL_VIDEO_FILES: {
      BUCKET_NAME: config.get<string>('object_storage.original_video_files.bucket_name'),
      PREFIX: config.get<string>('object_storage.original_video_files.prefix'),
      BASE_URL: config.get<string>('object_storage.original_video_files.base_url')
    }
  },
  WEBSERVER: {
    SCHEME: config.get<boolean>('webserver.https') === true ? 'https' : 'http',
    WS: config.get<boolean>('webserver.https') === true ? 'wss' : 'ws',
    HOSTNAME: config.get<string>('webserver.hostname'),
    PORT: config.get<number>('webserver.port')
  },
  OAUTH2: {
    TOKEN_LIFETIME: {
      ACCESS_TOKEN: parseDurationToMs(config.get<string>('oauth2.token_lifetime.access_token')),
      REFRESH_TOKEN: parseDurationToMs(config.get<string>('oauth2.token_lifetime.refresh_token'))
    }
  },
  RATES_LIMIT: {
    API: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.api.window')),
      MAX: config.get<number>('rates_limit.api.max')
    },
    SIGNUP: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.signup.window')),
      MAX: config.get<number>('rates_limit.signup.max')
    },
    LOGIN: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.login.window')),
      MAX: config.get<number>('rates_limit.login.max')
    },
    RECEIVE_CLIENT_LOG: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.receive_client_log.window')),
      MAX: config.get<number>('rates_limit.receive_client_log.max')
    },
    ASK_SEND_EMAIL: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.ask_send_email.window')),
      MAX: config.get<number>('rates_limit.ask_send_email.max')
    },
    PLUGINS: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.plugins.window')),
      MAX: config.get<number>('rates_limit.plugins.max')
    },
    WELL_KNOWN: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.well_known.window')),
      MAX: config.get<number>('rates_limit.well_known.max')
    },
    FEEDS: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.feeds.window')),
      MAX: config.get<number>('rates_limit.feeds.max')
    },
    ACTIVITY_PUB: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.activity_pub.window')),
      MAX: config.get<number>('rates_limit.activity_pub.max')
    },
    CLIENT: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.client.window')),
      MAX: config.get<number>('rates_limit.client.max')
    },
    DOWNLOAD_GENERATE_VIDEO: {
      WINDOW_MS: parseDurationToMs(config.get<string>('rates_limit.download_generate_video.window')),
      MAX: config.get<number>('rates_limit.download_generate_video.max')
    }
  },
  TRUST_PROXY: config.get<string[]>('trust_proxy'),
  LOG: {
    LEVEL: config.get<string>('log.level'),
    ROTATION: {
      ENABLED: config.get<boolean>('log.rotation.enabled'),
      MAX_FILE_SIZE: bytes.parse(config.get<string>('log.rotation.max_file_size')),
      MAX_FILES: config.get<number>('log.rotation.max_files')
    },
    ANONYMIZE_IP: config.get<boolean>('log.anonymize_ip'),
    LOG_PING_REQUESTS: config.get<boolean>('log.log_ping_requests'),
    LOG_TRACKER_UNKNOWN_INFOHASH: config.get<boolean>('log.log_tracker_unknown_infohash'),
    LOG_HTTP_REQUESTS: config.get<boolean>('log.log_http_requests'),
    PRETTIFY_SQL: config.get<boolean>('log.prettify_sql'),
    ACCEPT_CLIENT_LOG: config.get<boolean>('log.accept_client_log')
  },
  OPEN_TELEMETRY: {
    METRICS: {
      ENABLED: config.get<boolean>('open_telemetry.metrics.enabled'),

      PLAYBACK_STATS_INTERVAL: parseDurationToMs(config.get<string>('open_telemetry.metrics.playback_stats_interval')),

      HTTP_REQUEST_DURATION: {
        ENABLED: config.get<boolean>('open_telemetry.metrics.http_request_duration.enabled')
      },

      PROMETHEUS_EXPORTER: {
        HOSTNAME: config.get<string>('open_telemetry.metrics.prometheus_exporter.hostname'),
        PORT: config.get<number>('open_telemetry.metrics.prometheus_exporter.port')
      }
    },
    TRACING: {
      ENABLED: config.get<boolean>('open_telemetry.tracing.enabled'),

      JAEGER_EXPORTER: {
        ENDPOINT: config.get<string>('open_telemetry.tracing.jaeger_exporter.endpoint')
      }
    }
  },
  TRENDING: {
    VIDEOS: {
      INTERVAL_DAYS: config.get<number>('trending.videos.interval_days'),
      ALGORITHMS: {
        get ENABLED () { return config.get<string[]>('trending.videos.algorithms.enabled') },
        get DEFAULT () { return config.get<string>('trending.videos.algorithms.default') }
      }
    }
  },
  REDUNDANCY: {
    VIDEOS: {
      CHECK_INTERVAL: parseDurationToMs(config.get<string>('redundancy.videos.check_interval')),
      STRATEGIES: buildVideosRedundancy(config.get<any[]>('redundancy.videos.strategies'))
    }
  },
  REMOTE_REDUNDANCY: {
    VIDEOS: {
      ACCEPT_FROM: config.get<VideoRedundancyConfigFilter>('remote_redundancy.videos.accept_from')
    }
  },
  CSP: {
    ENABLED: config.get<boolean>('csp.enabled'),
    REPORT_ONLY: config.get<boolean>('csp.report_only'),
    REPORT_URI: config.get<string>('csp.report_uri')
  },
  SECURITY: {
    FRAMEGUARD: {
      ENABLED: config.get<boolean>('security.frameguard.enabled')
    },
    POWERED_BY_HEADER: {
      ENABLED: config.get<boolean>('security.powered_by_header.enabled')
    }
  },
  TRACKER: {
    ENABLED: config.get<boolean>('tracker.enabled'),
    PRIVATE: config.get<boolean>('tracker.private'),
    REJECT_TOO_MANY_ANNOUNCES: config.get<boolean>('tracker.reject_too_many_announces')
  },
  HISTORY: {
    VIDEOS: {
      MAX_AGE: parseDurationToMs(config.get('history.videos.max_age'))
    }
  },
  VIEWS: {
    VIDEOS: {
      REMOTE: {
        MAX_AGE: parseDurationToMs(config.get('views.videos.remote.max_age'))
      },
      LOCAL_BUFFER_UPDATE_INTERVAL: parseDurationToMs(config.get('views.videos.local_buffer_update_interval')),
      VIEW_EXPIRATION: parseDurationToMs(config.get('views.videos.view_expiration')),
      COUNT_VIEW_AFTER: parseDurationToMs(config.get<number>('views.videos.count_view_after')),
      TRUST_VIEWER_SESSION_ID: config.get<boolean>('views.videos.trust_viewer_session_id'),
      WATCHING_INTERVAL: {
        ANONYMOUS: parseDurationToMs(config.get<string>('views.videos.watching_interval.anonymous')),
        USERS: parseDurationToMs(config.get<string>('views.videos.watching_interval.users'))
      }
    }
  },
  GEO_IP: {
    ENABLED: config.get<boolean>('geo_ip.enabled'),
    COUNTRY: {
      DATABASE_URL: config.get<string>('geo_ip.country.database_url')
    },
    CITY: {
      DATABASE_URL: config.get<string>('geo_ip.city.database_url')
    }
  },
  PLUGINS: {
    INDEX: {
      ENABLED: config.get<boolean>('plugins.index.enabled'),
      CHECK_LATEST_VERSIONS_INTERVAL: parseDurationToMs(config.get<string>('plugins.index.check_latest_versions_interval')),
      URL: config.get<string>('plugins.index.url')
    }
  },
  FEDERATION: {
    ENABLED: config.get<boolean>('federation.enabled'),
    PREVENT_SSRF: config.get<boolean>('federation.prevent_ssrf'),
    VIDEOS: {
      FEDERATE_UNLISTED: config.get<boolean>('federation.videos.federate_unlisted'),
      CLEANUP_REMOTE_INTERACTIONS: config.get<boolean>('federation.videos.cleanup_remote_interactions')
    },
    SIGN_FEDERATED_FETCHES: config.get<boolean>('federation.sign_federated_fetches')
  },
  PEERTUBE: {
    CHECK_LATEST_VERSION: {
      ENABLED: config.get<boolean>('peertube.check_latest_version.enabled'),
      URL: config.get<string>('peertube.check_latest_version.url')
    }
  },
  WEBADMIN: {
    CONFIGURATION: {
      EDITION: {
        ALLOWED: config.get<boolean>('webadmin.configuration.edition.allowed')
      }
    }
  },
  FEEDS: {
    VIDEOS: {
      COUNT: config.get<number>('feeds.videos.count')
    },
    COMMENTS: {
      COUNT: config.get<number>('feeds.comments.count')
    }
  },
  REMOTE_RUNNERS: {
    STALLED_JOBS: {
      LIVE: parseDurationToMs(config.get<string>('remote_runners.stalled_jobs.live')),
      VOD: parseDurationToMs(config.get<string>('remote_runners.stalled_jobs.vod'))
    }
  },
  THUMBNAILS: {
    GENERATION_FROM_VIDEO: {
      FRAMES_TO_ANALYZE: config.get<number>('thumbnails.generation_from_video.frames_to_analyze')
    },
    SIZES: config.get<{ width: number, height: number }[]>('thumbnails.sizes')
  },
  STATS: {
    REGISTRATION_REQUESTS: {
      ENABLED: config.get<boolean>('stats.registration_requests.enabled')
    },
    ABUSES: {
      ENABLED: config.get<boolean>('stats.abuses.enabled')
    },
    TOTAL_MODERATORS: {
      ENABLED: config.get<boolean>('stats.total_moderators.enabled')
    },
    TOTAL_ADMINS: {
      ENABLED: config.get<boolean>('stats.total_admins.enabled')
    }
  },
  WEBRTC: {
    STUN_SERVERS: config.get<string[]>('webrtc.stun_servers')
  },
  ADMIN: {
    get EMAIL () { return config.get<string>('admin.email') }
  },
  CONTACT_FORM: {
    get ENABLED () { return config.get<boolean>('contact_form.enabled') }
  },
  SIGNUP: {
    get ENABLED () { return config.get<boolean>('signup.enabled') },
    get REQUIRES_APPROVAL () { return config.get<boolean>('signup.requires_approval') },
    get LIMIT () { return config.get<number>('signup.limit') },
    get REQUIRES_EMAIL_VERIFICATION () { return config.get<boolean>('signup.requires_email_verification') },
    get MINIMUM_AGE () { return config.get<number>('signup.minimum_age') },
    FILTERS: {
      CIDR: {
        get WHITELIST () { return config.get<string[]>('signup.filters.cidr.whitelist') },
        get BLACKLIST () { return config.get<string[]>('signup.filters.cidr.blacklist') }
      }
    }
  },
  USER: {
    HISTORY: {
      VIDEOS: {
        get ENABLED () { return config.get<boolean>('user.history.videos.enabled') }
      }
    },
    get VIDEO_QUOTA () { return parseBytes(config.get<number>('user.video_quota')) },
    get VIDEO_QUOTA_DAILY () { return parseBytes(config.get<number>('user.video_quota_daily')) },
    get DEFAULT_CHANNEL_NAME () { return config.get<string>('user.default_channel_name') }
  },
  VIDEO_CHANNELS: {
    get MAX_PER_USER () { return config.get<number>('video_channels.max_per_user') }
  },
  TRANSCODING: {
    get ENABLED () { return config.get<boolean>('transcoding.enabled') },
    ORIGINAL_FILE: {
      get KEEP () { return config.get<boolean>('transcoding.original_file.keep') }
    },
    get ALLOW_ADDITIONAL_EXTENSIONS () { return config.get<boolean>('transcoding.allow_additional_extensions') },
    get ALLOW_AUDIO_FILES () { return config.get<boolean>('transcoding.allow_audio_files') },
    get THREADS () { return config.get<number>('transcoding.threads') },
    get CONCURRENCY () { return config.get<number>('transcoding.concurrency') },
    get PROFILE () { return config.get<string>('transcoding.profile') },
    get ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION () { return config.get<boolean>('transcoding.always_transcode_original_resolution') },
    RESOLUTIONS: {
      get '0p' () { return config.get<boolean>('transcoding.resolutions.0p') },
      get '144p' () { return config.get<boolean>('transcoding.resolutions.144p') },
      get '240p' () { return config.get<boolean>('transcoding.resolutions.240p') },
      get '360p' () { return config.get<boolean>('transcoding.resolutions.360p') },
      get '480p' () { return config.get<boolean>('transcoding.resolutions.480p') },
      get '720p' () { return config.get<boolean>('transcoding.resolutions.720p') },
      get '1080p' () { return config.get<boolean>('transcoding.resolutions.1080p') },
      get '1440p' () { return config.get<boolean>('transcoding.resolutions.1440p') },
      get '2160p' () { return config.get<boolean>('transcoding.resolutions.2160p') }
    },
    FPS: {
      get MAX () { return config.get<number>('transcoding.fps.max') }
    },
    HLS: {
      get ENABLED () { return config.get<boolean>('transcoding.hls.enabled') },
      get SPLIT_AUDIO_AND_VIDEO () { return config.get<boolean>('transcoding.hls.split_audio_and_video') }
    },
    WEB_VIDEOS: {
      get ENABLED () { return config.get<boolean>('transcoding.web_videos.enabled') }
    },
    REMOTE_RUNNERS: {
      get ENABLED () { return config.get<boolean>('transcoding.remote_runners.enabled') }
    }
  },
  LIVE: {
    get ENABLED () { return config.get<boolean>('live.enabled') },

    get MAX_DURATION () { return parseDurationToMs(config.get<string>('live.max_duration')) },
    get MAX_INSTANCE_LIVES () { return config.get<number>('live.max_instance_lives') },
    get MAX_USER_LIVES () { return config.get<number>('live.max_user_lives') },

    get ALLOW_REPLAY () { return config.get<boolean>('live.allow_replay') },

    LATENCY_SETTING: {
      get ENABLED () { return config.get<boolean>('live.latency_setting.enabled') }
    },

    RTMP: {
      get ENABLED () { return config.get<boolean>('live.rtmp.enabled') },
      get PORT () { return config.get<number>('live.rtmp.port') },
      get HOSTNAME () { return config.get<number>('live.rtmp.hostname') },
      get PUBLIC_HOSTNAME () { return config.get<number>('live.rtmp.public_hostname') }
    },

    RTMPS: {
      get ENABLED () { return config.get<boolean>('live.rtmps.enabled') },
      get PORT () { return config.get<number>('live.rtmps.port') },
      get HOSTNAME () { return config.get<number>('live.rtmps.hostname') },
      get PUBLIC_HOSTNAME () { return config.get<number>('live.rtmps.public_hostname') },
      get KEY_FILE () { return config.get<string>('live.rtmps.key_file') },
      get CERT_FILE () { return config.get<string>('live.rtmps.cert_file') }
    },

    TRANSCODING: {
      get ENABLED () { return config.get<boolean>('live.transcoding.enabled') },
      get THREADS () { return config.get<number>('live.transcoding.threads') },
      get PROFILE () { return config.get<string>('live.transcoding.profile') },

      get ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION () { return config.get<boolean>('live.transcoding.always_transcode_original_resolution') },

      RESOLUTIONS: {
        get '0p' () { return config.get<boolean>('live.transcoding.resolutions.0p') },
        get '144p' () { return config.get<boolean>('live.transcoding.resolutions.144p') },
        get '240p' () { return config.get<boolean>('live.transcoding.resolutions.240p') },
        get '360p' () { return config.get<boolean>('live.transcoding.resolutions.360p') },
        get '480p' () { return config.get<boolean>('live.transcoding.resolutions.480p') },
        get '720p' () { return config.get<boolean>('live.transcoding.resolutions.720p') },
        get '1080p' () { return config.get<boolean>('live.transcoding.resolutions.1080p') },
        get '1440p' () { return config.get<boolean>('live.transcoding.resolutions.1440p') },
        get '2160p' () { return config.get<boolean>('live.transcoding.resolutions.2160p') }
      },

      FPS: {
        get MAX () { return config.get<number>('live.transcoding.fps.max') }
      },

      REMOTE_RUNNERS: {
        get ENABLED () { return config.get<boolean>('live.transcoding.remote_runners.enabled') }
      }
    }
  },
  VIDEO_STUDIO: {
    get ENABLED () { return config.get<boolean>('video_studio.enabled') },
    REMOTE_RUNNERS: {
      get ENABLED () { return config.get<boolean>('video_studio.remote_runners.enabled') }
    }
  },
  VIDEO_FILE: {
    UPDATE: {
      get ENABLED () { return config.get<boolean>('video_file.update.enabled') }
    }
  },
  VIDEO_TRANSCRIPTION: {
    get ENABLED () { return config.get<boolean>('video_transcription.enabled') },
    get ENGINE () { return config.get<TranscriptionEngineName>('video_transcription.engine') },
    get ENGINE_PATH () { return config.get<string>('video_transcription.engine_path') },
    get MODEL () { return config.get<WhisperBuiltinModelName>('video_transcription.model') },
    get MODEL_PATH () { return config.get<string>('video_transcription.model_path') },
    REMOTE_RUNNERS: {
      get ENABLED () { return config.get<boolean>('video_transcription.remote_runners.enabled') }
    }
  },
  IMPORT: {
    VIDEOS: {
      get CONCURRENCY () { return config.get<number>('import.videos.concurrency') },
      get TIMEOUT () { return parseDurationToMs(config.get<string>('import.videos.timeout')) },

      HTTP: {
        get ENABLED () { return config.get<boolean>('import.videos.http.enabled') },

        YOUTUBE_DL_RELEASE: {
          get URL () { return config.get<string>('import.videos.http.youtube_dl_release.url') },
          get NAME () { return config.get<string>('import.videos.http.youtube_dl_release.name') },
          get PYTHON_PATH () { return config.get<string>('import.videos.http.youtube_dl_release.python_path') }
        },

        get FORCE_IPV4 () { return config.get<boolean>('import.videos.http.force_ipv4') },

        get PROXIES () { return config.get<string[]>('import.videos.http.proxies') }
      },
      TORRENT: {
        get ENABLED () { return config.get<boolean>('import.videos.torrent.enabled') }
      }
    },
    VIDEO_CHANNEL_SYNCHRONIZATION: {
      get ENABLED () { return config.get<boolean>('import.video_channel_synchronization.enabled') },
      get MAX_PER_USER () { return config.get<number>('import.video_channel_synchronization.max_per_user') },
      get CHECK_INTERVAL () { return parseDurationToMs(config.get<string>('import.video_channel_synchronization.check_interval')) },
      get VIDEOS_LIMIT_PER_SYNCHRONIZATION () {
        return config.get<number>('import.video_channel_synchronization.videos_limit_per_synchronization')
      },
      get FULL_SYNC_VIDEOS_LIMIT () {
        return config.get<number>('import.video_channel_synchronization.full_sync_videos_limit')
      }
    },
    USERS: {
      get ENABLED () { return config.get<boolean>('import.users.enabled') }
    }
  },
  EXPORT: {
    USERS: {
      get ENABLED () { return config.get<boolean>('export.users.enabled') },
      get MAX_USER_VIDEO_QUOTA () { return parseBytes(config.get<string>('export.users.max_user_video_quota')) },
      get EXPORT_EXPIRATION () { return parseDurationToMs(config.get<string>('export.users.export_expiration')) }
    }
  },
  AUTO_BLACKLIST: {
    VIDEOS: {
      OF_USERS: {
        get ENABLED () { return config.get<boolean>('auto_blacklist.videos.of_users.enabled') }
      }
    }
  },
  CACHE: {
    PREVIEWS: {
      get SIZE () { return config.get<number>('cache.previews.size') }
    },
    VIDEO_CAPTIONS: {
      get SIZE () { return config.get<number>('cache.captions.size') }
    },
    TORRENTS: {
      get SIZE () { return config.get<number>('cache.torrents.size') }
    },
    STORYBOARDS: {
      get SIZE () { return config.get<number>('cache.storyboards.size') }
    }
  },
  INSTANCE: {
    get NAME () { return config.get<string>('instance.name') },
    get SHORT_DESCRIPTION () { return config.get<string>('instance.short_description') },
    get DESCRIPTION () { return config.get<string>('instance.description') },
    get TERMS () { return config.get<string>('instance.terms') },
    get CODE_OF_CONDUCT () { return config.get<string>('instance.code_of_conduct') },

    get CREATION_REASON () { return config.get<string>('instance.creation_reason') },

    get MODERATION_INFORMATION () { return config.get<string>('instance.moderation_information') },
    get ADMINISTRATOR () { return config.get<string>('instance.administrator') },
    get MAINTENANCE_LIFETIME () { return config.get<string>('instance.maintenance_lifetime') },
    get BUSINESS_MODEL () { return config.get<string>('instance.business_model') },
    get HARDWARE_INFORMATION () { return config.get<string>('instance.hardware_information') },

    get LANGUAGES () { return config.get<string[]>('instance.languages') || [] },
    get CATEGORIES () { return config.get<number[]>('instance.categories') || [] },

    get IS_NSFW () { return config.get<boolean>('instance.is_nsfw') },
    get DEFAULT_NSFW_POLICY () { return config.get<NSFWPolicyType>('instance.default_nsfw_policy') },

    get SERVER_COUNTRY () { return config.get<string>('instance.server_country') },

    SUPPORT: {
      get TEXT () { return config.get<string>('instance.support.text') }
    },

    SOCIAL: {
      get EXTERNAL_LINK () { return config.get<string>('instance.social.external_link') },
      get MASTODON_LINK () { return config.get<string>('instance.social.mastodon_link') },
      get BLUESKY () { return config.get<string>('instance.social.bluesky_link') }
    },

    get DEFAULT_CLIENT_ROUTE () { return config.get<string>('instance.default_client_route') },

    CUSTOMIZATIONS: {
      get JAVASCRIPT () { return config.get<string>('instance.customizations.javascript') },
      get CSS () { return config.get<string>('instance.customizations.css') }
    },
    get ROBOTS () { return config.get<string>('instance.robots') },
    get SECURITYTXT () { return config.get<string>('instance.securitytxt') }
  },
  SERVICES: {
    TWITTER: {
      get USERNAME () { return config.get<string>('services.twitter.username') }
    }
  },
  FOLLOWERS: {
    INSTANCE: {
      get ENABLED () { return config.get<boolean>('followers.instance.enabled') },
      get MANUAL_APPROVAL () { return config.get<boolean>('followers.instance.manual_approval') }
    }
  },
  FOLLOWINGS: {
    INSTANCE: {
      AUTO_FOLLOW_BACK: {
        get ENABLED () {
          return config.get<boolean>('followings.instance.auto_follow_back.enabled')
        }
      },
      AUTO_FOLLOW_INDEX: {
        get ENABLED () {
          return config.get<boolean>('followings.instance.auto_follow_index.enabled')
        },
        get INDEX_URL () {
          return config.get<string>('followings.instance.auto_follow_index.index_url')
        }
      }
    }
  },
  THEME: {
    get DEFAULT () { return config.get<string>('theme.default') }
  },
  BROADCAST_MESSAGE: {
    get ENABLED () { return config.get<boolean>('broadcast_message.enabled') },
    get MESSAGE () { return config.get<string>('broadcast_message.message') },
    get LEVEL () { return config.get<BroadcastMessageLevel>('broadcast_message.level') },
    get DISMISSABLE () { return config.get<boolean>('broadcast_message.dismissable') }
  },
  SEARCH: {
    REMOTE_URI: {
      get USERS () { return config.get<boolean>('search.remote_uri.users') },
      get ANONYMOUS () { return config.get<boolean>('search.remote_uri.anonymous') }
    },
    SEARCH_INDEX: {
      get ENABLED () { return config.get<boolean>('search.search_index.enabled') },
      get URL () { return config.get<string>('search.search_index.url') },
      get DISABLE_LOCAL_SEARCH () { return config.get<boolean>('search.search_index.disable_local_search') },
      get IS_DEFAULT_SEARCH () { return config.get<boolean>('search.search_index.is_default_search') }
    }
  },
  STORYBOARDS: {
    get ENABLED () { return config.get<boolean>('storyboards.enabled') }
  }
}

function registerConfigChangedHandler (fun: Function) {
  configChangedHandlers.push(fun)
}

function isEmailEnabled () {
  if (CONFIG.SMTP.TRANSPORT === 'sendmail' && CONFIG.SMTP.SENDMAIL) return true

  if (CONFIG.SMTP.TRANSPORT === 'smtp' && CONFIG.SMTP.HOSTNAME && CONFIG.SMTP.PORT) return true

  return false
}

function getLocalConfigFilePath () {
  const localConfigDir = getLocalConfigDir()

  let filename = 'local'
  if (process.env.NODE_ENV) filename += `-${process.env.NODE_ENV}`
  if (process.env.NODE_APP_INSTANCE) filename += `-${process.env.NODE_APP_INSTANCE}`

  return join(localConfigDir, filename + '.json')
}

function getConfigModule () {
  return config
}

// ---------------------------------------------------------------------------

export {
  CONFIG,
  getConfigModule,
  getLocalConfigFilePath,
  registerConfigChangedHandler,
  isEmailEnabled
}

// ---------------------------------------------------------------------------

function getLocalConfigDir () {
  if (process.env.PEERTUBE_LOCAL_CONFIG) return process.env.PEERTUBE_LOCAL_CONFIG

  const configSources = config.util.getConfigSources()
  if (configSources.length === 0) throw new Error('Invalid config source.')

  return dirname(configSources[0].name)
}

function buildVideosRedundancy (objs: any[]): VideosRedundancyStrategy[] {
  if (!objs) return []

  if (!Array.isArray(objs)) return objs

  return objs.map(obj => {
    return Object.assign({}, obj, {
      minLifetime: parseDurationToMs(obj.min_lifetime),
      size: bytes.parse(obj.size),
      minViews: obj.min_views
    })
  })
}

export function reloadConfig () {

  function getConfigDirectories () {
    if (process.env.NODE_CONFIG_DIR) {
      return process.env.NODE_CONFIG_DIR.split(':')
    }

    return [ join(root(), 'config') ]
  }

  function purge () {
    const directories = getConfigDirectories()

    for (const fileName in require.cache) {
      if (directories.some((dir) => fileName.includes(dir)) === false) {
        continue
      }

      delete require.cache[fileName]
    }

    decacheModule(require, 'config')
  }

  purge()

  config = require('config')

  for (const configChangedHandler of configChangedHandlers) {
    configChangedHandler()
  }

  return Promise.resolve()
}
