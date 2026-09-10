import { guessAspectRatio, sortBy } from '@peertube/peertube-core-utils'
import {
  BroadcastMessageLevel,
  NSFWPolicyType,
  PlayerTheme,
  ThumbnailAspectRatio,
  VideoCommentPolicyType,
  VideoPrivacyType,
  VideoRedundancyConfigFilter,
  VideosRedundancyStrategy
} from '@peertube/peertube-models'
import { buildPath, parseBytes, parseDurationToMs } from '@peertube/peertube-node-utils'
import { TranscriptionEngineName, WhisperBuiltinModelName } from '@peertube/peertube-transcription'
import bytes from 'bytes'
import { dirname, join } from 'path'
import { type ConfigInstance, initConfig, reloadConfigInstance } from './config/config-loader.js'

let config = await initConfig()

const configChangedHandlers: Function[] = []

// ---------------------------------------------------------------------------
// Configuration tiers
// ---------------------------------------------------------------------------

/**
 * Every `CONFIG` key declares when its value is read:
 *  * `staticKey` is read once, when this module is loaded. `reloadConfig()` does **not** update it
 *  * `dynamicKey` is re-read on every access, so `reloadConfig()` applies immediately.
 *     They are the config values admin can update on the fly in the web admin
 */

type ConfigTier = 'static' | 'dynamic'

type ConfigKey<T> = {
  tier: ConfigTier

  // Configuration paths this value is built from, for `CONFIG_TIERS`
  properties: string[]

  read: () => T
}

type ConfigKeyOptions<T> = {
  transform?: (value: any) => T
}

type ConfigSpec = Record<string, unknown>

type BuiltConfig<S> = {
  [K in keyof S]: S[K] extends ConfigKey<infer T> ? T
    : S[K] extends object ? BuiltConfig<S[K]>
    : S[K]
}

// ---------------------------------------------------------------------------

export function isEmailEnabled () {
  if (CONFIG.SMTP.TRANSPORT === 'sendmail' && CONFIG.SMTP.SENDMAIL) return true

  if (CONFIG.SMTP.TRANSPORT === 'smtp' && CONFIG.SMTP.HOSTNAME && CONFIG.SMTP.PORT) return true

  return false
}

export function getLocalConfigFilePath () {
  const localConfigDir = getLocalConfigDir()

  let filename = 'local'
  if (process.env.NODE_ENV) filename += `-${process.env.NODE_ENV}`
  if (process.env.NODE_APP_INSTANCE) filename += `-${process.env.NODE_APP_INSTANCE}`

  return join(localConfigDir, filename + '.json')
}

export function getConfigModule (): ConfigInstance {
  return config
}

export function reloadConfig () {
  config = reloadConfigInstance()

  for (const configChangedHandler of configChangedHandlers) {
    configChangedHandler()
  }

  return Promise.resolve()
}

// Configuration path -> tier
// Exported so tests can assert the classification
export const CONFIG_TIERS: Record<string, ConfigTier> = {}

export const CONFIG = buildConfig({
  CUSTOM_FILE: getLocalConfigFilePath(),
  LISTEN: {
    PORT: staticKey<number>('listen.port'),
    HOSTNAME: staticKey<string>('listen.hostname')
  },
  SECRETS: {
    PEERTUBE: staticKey<string>('secrets.peertube')
  },
  HTTP_TIMEOUTS: {
    REQUEST: staticKey('http_timeouts.request', { transform: parseDurationToMs })
  },
  DATABASE: {
    DBNAME: staticComputed([ 'database.name', 'database.suffix' ], () => {
      return config.has('database.name')
        ? config.get<string>('database.name')
        : 'peertube' + config.get<string>('database.suffix')
    }),
    HOSTNAME: staticKey<string>('database.hostname'),
    PORT: staticKey<number>('database.port'),
    SSL: staticKey<boolean>('database.ssl'),
    SSL_SETTINGS: {
      REJECT_UNAUTHORIZED: dynamicKey<boolean>('database.ssl_settings.reject_unauthorized'),
      CA: dynamicKey<string>('database.ssl_settings.ca'),
      CERT: dynamicKey<string>('database.ssl_settings.cert'),
      KEY: dynamicKey<string>('database.ssl_settings.key')
    },
    USERNAME: staticKey<string>('database.username'),
    PASSWORD: staticKey<string>('database.password'),
    POOL: {
      MAX: staticKey<number>('database.pool.max')
    }
  },
  REDIS: {
    HOSTNAME: staticKey<string>('redis.hostname'),
    PORT: staticKey<number>('redis.port'),
    SOCKET: staticKey<string>('redis.socket'),
    AUTH: staticKey<string>('redis.auth'),
    DB: staticKey<number>('redis.db'),
    ENABLE_TLS: staticKey<boolean>('redis.enable_tls'),
    TLS_SETTINGS: {
      REJECT_UNAUTHORIZED: dynamicKey<boolean>('redis.tls_settings.reject_unauthorized'),
      CA: dynamicKey<string>('redis.tls_settings.ca'),
      CERT: dynamicKey<string>('redis.tls_settings.cert'),
      KEY: dynamicKey<string>('redis.tls_settings.key')
    },
    SENTINEL: {
      ENABLED: staticKey<boolean>('redis.sentinel.enabled'),
      ENABLE_TLS: staticKey<boolean>('redis.sentinel.enable_tls'),
      TLS_SETTINGS: {
        REJECT_UNAUTHORIZED: dynamicKey<boolean>('redis.sentinel.tls_settings.reject_unauthorized'),
        CA: dynamicKey<string>('redis.sentinel.tls_settings.ca'),
        CERT: dynamicKey<string>('redis.sentinel.tls_settings.cert'),
        KEY: dynamicKey<string>('redis.sentinel.tls_settings.key')
      },
      SENTINELS: staticKey<{ host: string, port: number }[]>('redis.sentinel.sentinels'),
      MASTER_NAME: staticKey<string>('redis.sentinel.master_name'),
      PASSWORD: staticKey<string>('redis.sentinel.password')
    }
  },
  SMTP: {
    TRANSPORT: staticKey<string>('smtp.transport'),
    SENDMAIL: staticKey<string>('smtp.sendmail'),
    HOSTNAME: staticKey<string>('smtp.hostname'),
    PORT: staticKey<number>('smtp.port'),
    USERNAME: staticKey<string>('smtp.username'),
    PASSWORD: staticKey<string>('smtp.password'),
    TLS: staticKey<boolean>('smtp.tls'),
    DISABLE_STARTTLS: staticKey<boolean>('smtp.disable_starttls'),
    CA_FILE: staticKey<string>('smtp.ca_file'),
    FROM_ADDRESS: staticKey<string>('smtp.from_address')
  },

  NSFW_FLAGS_SETTINGS: {
    ENABLED: staticKey<boolean>('nsfw_flags_settings.enabled')
  },

  BLOCKLIST: {
    PUBLIC_LOG: {
      ENABLED: dynamicKey<boolean>('blocklist.public_log.enabled')
    }
  },

  DOWNLOAD: {
    MAX_TOTAL_BYTES_PER_SECOND: staticComputed([ 'download.max_total_bytes_per_second' ], () => {
      return config.get<string | number | null>('download.max_total_bytes_per_second') === null
        ? null
        : parseBytes(config.get<string | number>('download.max_total_bytes_per_second'))
    }),
    MAX_BYTES_PER_IP_PER_SECOND: staticComputed([ 'download.max_bytes_per_ip_per_second' ], () => {
      return config.get<string | number | null>('download.max_bytes_per_ip_per_second') === null
        ? null
        : parseBytes(config.get<string | number>('download.max_bytes_per_ip_per_second'))
    })
  },

  DOWNLOAD_GENERATE_VIDEO: {
    MAX_PARALLEL_DOWNLOADS: staticKey<number>('download_generate_video.max_parallel_downloads')
  },

  CLIENT: {
    NEW_FEATURES_INFO: dynamicKey<boolean>('client.new_features_info'),
    HEADER: {
      HIDE_INSTANCE_NAME: dynamicKey<boolean>('client.header.hide_instance_name')
    },
    VIDEOS: {
      MINIATURE: {
        PREFER_AUTHOR_DISPLAY_NAME: dynamicKey<boolean>('client.videos.miniature.prefer_author_display_name')
      },
      RESUMABLE_UPLOAD: {
        MAX_CHUNK_SIZE: dynamicComputed([ 'client.videos.resumable_upload.max_chunk_size' ], () => {
          return parseBytes(config.get<number>('client.videos.resumable_upload.max_chunk_size') || 0)
        })
      }
    },
    BROWSE_VIDEOS: {
      DEFAULT_SORT: dynamicKey<string>('client.browse_videos.default_sort'),
      DEFAULT_SCOPE: dynamicKey<string>('client.browse_videos.default_scope')
    },
    MENU: {
      LOGIN: {
        REDIRECT_ON_SINGLE_EXTERNAL_AUTH: dynamicKey<boolean>('client.menu.login.redirect_on_single_external_auth')
      }
    },
    OPEN_IN_APP: {
      ANDROID: {
        INTENT: {
          ENABLED: dynamicKey<boolean>('client.open_in_app.android.intent.enabled'),
          HOST: dynamicKey<string>('client.open_in_app.android.intent.host'),
          SCHEME: dynamicKey<string>('client.open_in_app.android.intent.scheme'),
          FALLBACK_URL: dynamicKey<string>('client.open_in_app.android.intent.fallback_url')
        }
      },
      IOS: {
        ENABLED: dynamicKey<boolean>('client.open_in_app.ios.enabled'),
        HOST: dynamicKey<string>('client.open_in_app.ios.host'),
        SCHEME: dynamicKey<string>('client.open_in_app.ios.scheme'),
        FALLBACK_URL: dynamicKey<string>('client.open_in_app.ios.fallback_url')
      }
    }
  },

  DEFAULTS: {
    PUBLISH: {
      DOWNLOAD_ENABLED: dynamicKey<boolean>('defaults.publish.download_enabled'),
      COMMENTS_POLICY: dynamicKey<VideoCommentPolicyType>('defaults.publish.comments_policy'),
      PRIVACY: dynamicKey<VideoPrivacyType>('defaults.publish.privacy'),
      LICENCE: dynamicKey<number>('defaults.publish.licence')
    },
    LIVE: {
      SAVE_REPLAY: dynamicKey<boolean>('defaults.live.save_replay')
    },
    P2P: {
      WEBAPP: {
        ENABLED: dynamicKey<boolean>('defaults.p2p.webapp.enabled')
      },
      EMBED: {
        ENABLED: dynamicKey<boolean>('defaults.p2p.embed.enabled')
      }
    },
    PLAYER: {
      THEME: dynamicKey<PlayerTheme>('defaults.player.theme'),
      AUTO_PLAY: dynamicKey<boolean>('defaults.player.auto_play')
    }
  },

  STORAGE: {
    TMP_DIR: staticKey('storage.tmp', { transform: buildPath }),
    TMP_PERSISTENT_DIR: staticKey('storage.tmp_persistent', { transform: buildPath }),
    BIN_DIR: staticKey('storage.bin', { transform: buildPath }),
    ACTOR_IMAGES_DIR: staticKey('storage.avatars', { transform: buildPath }),
    LOG_DIR: staticKey('storage.logs', { transform: buildPath }),
    WEB_VIDEOS_DIR: staticKey('storage.web_videos', { transform: buildPath }),
    STREAMING_PLAYLISTS_DIR: staticKey('storage.streaming_playlists', { transform: buildPath }),
    ORIGINAL_VIDEO_FILES_DIR: staticKey('storage.original_video_files', { transform: buildPath }),
    REDUNDANCY_DIR: staticKey('storage.redundancy', { transform: buildPath }),
    THUMBNAILS_DIR: staticKey('storage.thumbnails', { transform: buildPath }),
    STORYBOARDS_DIR: staticKey('storage.storyboards', { transform: buildPath }),
    PREVIEWS_DIR: staticKey('storage.previews', { transform: buildPath }),
    CAPTIONS_DIR: staticKey('storage.captions', { transform: buildPath }),
    TORRENTS_DIR: staticKey('storage.torrents', { transform: buildPath }),
    CACHE_DIR: staticKey('storage.cache', { transform: buildPath }),
    PLUGINS_DIR: staticKey('storage.plugins', { transform: buildPath }),
    CLIENT_OVERRIDES_DIR: staticKey('storage.client_overrides', { transform: buildPath }),
    WELL_KNOWN_DIR: staticKey('storage.well_known', { transform: buildPath }),
    UPLOADS_DIR: staticKey('storage.uploads', { transform: buildPath })
  },
  STATIC_FILES: {
    PRIVATE_FILES_REQUIRE_AUTH: staticKey<boolean>('static_files.private_files_require_auth')
  },
  OBJECT_STORAGE: {
    ENABLED: staticKey<boolean>('object_storage.enabled'),
    MAX_UPLOAD_PART: staticKey('object_storage.max_upload_part', { transform: bytes.parse }),
    MAX_REQUEST_ATTEMPTS: staticKey<number>('object_storage.max_request_attempts'),
    ENDPOINT: staticKey<string>('object_storage.endpoint'),
    REGION: staticKey<string>('object_storage.region'),
    FORCE_PATH_STYLE: staticKey<boolean>('object_storage.force_path_style'),
    UPLOAD_ACL: {
      PUBLIC: staticKey<string>('object_storage.upload_acl.public'),
      PRIVATE: staticKey<string>('object_storage.upload_acl.private')
    },
    CREDENTIALS: {
      ACCESS_KEY_ID: staticKey<string>('object_storage.credentials.access_key_id'),
      SECRET_ACCESS_KEY: staticKey<string>('object_storage.credentials.secret_access_key')
    },
    PROXY: {
      PROXIFY_PRIVATE_FILES: staticKey<boolean>('object_storage.proxy.proxify_private_files')
    },
    WEB_VIDEOS: {
      BUCKET_NAME: staticKey<string>('object_storage.web_videos.bucket_name'),
      PREFIX: staticKey<string>('object_storage.web_videos.prefix'),
      BASE_URL: staticKey<string>('object_storage.web_videos.base_url')
    },
    STREAMING_PLAYLISTS: {
      BUCKET_NAME: staticKey<string>('object_storage.streaming_playlists.bucket_name'),
      PREFIX: staticKey<string>('object_storage.streaming_playlists.prefix'),
      BASE_URL: staticKey<string>('object_storage.streaming_playlists.base_url'),
      STORE_LIVE_STREAMS: staticKey<string>('object_storage.streaming_playlists.store_live_streams')
    },
    USER_EXPORTS: {
      BUCKET_NAME: staticKey<string>('object_storage.user_exports.bucket_name'),
      PREFIX: staticKey<string>('object_storage.user_exports.prefix'),
      BASE_URL: staticKey<string>('object_storage.user_exports.base_url')
    },
    ORIGINAL_VIDEO_FILES: {
      BUCKET_NAME: staticKey<string>('object_storage.original_video_files.bucket_name'),
      PREFIX: staticKey<string>('object_storage.original_video_files.prefix'),
      BASE_URL: staticKey<string>('object_storage.original_video_files.base_url')
    },
    CAPTIONS: {
      BUCKET_NAME: staticKey<string>('object_storage.captions.bucket_name'),
      PREFIX: staticKey<string>('object_storage.captions.prefix'),
      BASE_URL: staticKey<string>('object_storage.captions.base_url')
    }
  },
  WEBSERVER: {
    SCHEME: staticComputed([ 'webserver.https' ], () => config.get<boolean>('webserver.https') === true ? 'https' : 'http'),
    WS: staticComputed([ 'webserver.https' ], () => config.get<boolean>('webserver.https') === true ? 'wss' : 'ws'),
    HOSTNAME: staticKey<string>('webserver.hostname'),
    PORT: staticKey<number>('webserver.port')
  },
  OAUTH2: {
    TOKEN_LIFETIME: {
      ACCESS_TOKEN: staticKey('oauth2.token_lifetime.access_token', { transform: parseDurationToMs }),
      REFRESH_TOKEN: staticKey('oauth2.token_lifetime.refresh_token', { transform: parseDurationToMs })
    }
  },
  RATES_LIMIT: {
    API: {
      ENABLED: staticKey<boolean>('rates_limit.api.enabled'),
      WINDOW_MS: staticKey('rates_limit.api.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.api.max')
    },
    SIGNUP: {
      ENABLED: staticKey<boolean>('rates_limit.signup.enabled'),
      WINDOW_MS: staticKey('rates_limit.signup.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.signup.max')
    },
    LOGIN: {
      ENABLED: staticKey<boolean>('rates_limit.login.enabled'),
      WINDOW_MS: staticKey('rates_limit.login.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.login.max')
    },
    RECEIVE_CLIENT_LOG: {
      ENABLED: staticKey<boolean>('rates_limit.receive_client_log.enabled'),
      WINDOW_MS: staticKey('rates_limit.receive_client_log.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.receive_client_log.max')
    },
    ASK_SEND_EMAIL: {
      ENABLED: staticKey<boolean>('rates_limit.ask_send_email.enabled'),
      WINDOW_MS: staticKey('rates_limit.ask_send_email.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.ask_send_email.max')
    },
    CONFIRM_TOKEN: {
      ENABLED: staticKey<boolean>('rates_limit.confirm_token.enabled'),
      WINDOW_MS: staticKey('rates_limit.confirm_token.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.confirm_token.max')
    },
    PLUGINS: {
      ENABLED: staticKey<boolean>('rates_limit.plugins.enabled'),
      WINDOW_MS: staticKey('rates_limit.plugins.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.plugins.max')
    },
    WELL_KNOWN: {
      ENABLED: staticKey<boolean>('rates_limit.well_known.enabled'),
      WINDOW_MS: staticKey('rates_limit.well_known.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.well_known.max')
    },
    FEEDS: {
      ENABLED: staticKey<boolean>('rates_limit.feeds.enabled'),
      WINDOW_MS: staticKey('rates_limit.feeds.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.feeds.max')
    },
    ACTIVITY_PUB: {
      ENABLED: staticKey<boolean>('rates_limit.activity_pub.enabled'),
      WINDOW_MS: staticKey('rates_limit.activity_pub.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.activity_pub.max')
    },
    CLIENT: {
      ENABLED: staticKey<boolean>('rates_limit.client.enabled'),
      WINDOW_MS: staticKey('rates_limit.client.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.client.max')
    },
    DOWNLOAD_GENERATE_VIDEO: {
      ENABLED: staticKey<boolean>('rates_limit.download_generate_video.enabled'),
      WINDOW_MS: staticKey('rates_limit.download_generate_video.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.download_generate_video.max')
    },
    REPORT_ABUSE: {
      ENABLED: staticKey<boolean>('rates_limit.report_abuse.enabled'),
      WINDOW_MS: staticKey('rates_limit.report_abuse.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.report_abuse.max')
    },
    CREATE_COMMENT: {
      ENABLED: staticKey<boolean>('rates_limit.create_comment.enabled'),
      WINDOW_MS: staticKey('rates_limit.create_comment.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.create_comment.max')
    },
    LOGIN_LOCKOUT: {
      ENABLED: staticKey<boolean>('rates_limit.login_lockout.enabled'),
      WINDOW_MS: staticKey('rates_limit.login_lockout.window', { transform: parseDurationToMs }),
      MAX: staticKey<number>('rates_limit.login_lockout.max'),
      MAX_PER_IP: staticKey<number>('rates_limit.login_lockout.max_per_ip')
    }
  },
  TRUST_PROXY: staticKey<string[]>('trust_proxy'),
  LOG: {
    LEVEL: staticKey<string>('log.level'),
    ROTATION: {
      ENABLED: staticKey<boolean>('log.rotation.enabled'),
      MAX_FILE_SIZE: staticKey('log.rotation.max_file_size', { transform: bytes.parse }),
      MAX_FILES: staticKey<number>('log.rotation.max_files')
    },
    ANONYMIZE_IP: staticKey<boolean>('log.anonymize_ip'),
    TAG_REQUESTS: staticKey<boolean>('log.tag_requests'),
    LOG_PING_REQUESTS: staticKey<boolean>('log.log_ping_requests'),
    LOG_TRACKER_UNKNOWN_INFOHASH: staticKey<boolean>('log.log_tracker_unknown_infohash'),
    LOG_HTTP_REQUESTS: staticKey<boolean>('log.log_http_requests'),
    PRETTIFY_SQL: staticKey<boolean>('log.prettify_sql'),
    ACCEPT_CLIENT_LOG: staticKey<boolean>('log.accept_client_log')
  },
  OPEN_TELEMETRY: {
    METRICS: {
      ENABLED: staticKey<boolean>('open_telemetry.metrics.enabled'),

      PLAYBACK_STATS_INTERVAL: staticKey('open_telemetry.metrics.playback_stats_interval', { transform: parseDurationToMs }),

      HTTP_REQUEST_DURATION: {
        ENABLED: staticKey<boolean>('open_telemetry.metrics.http_request_duration.enabled')
      },

      PROMETHEUS_EXPORTER: {
        HOSTNAME: staticKey<string>('open_telemetry.metrics.prometheus_exporter.hostname'),
        PORT: staticKey<number>('open_telemetry.metrics.prometheus_exporter.port')
      }
    },
    TRACING: {
      ENABLED: staticKey<boolean>('open_telemetry.tracing.enabled'),

      JAEGER_EXPORTER: {
        ENDPOINT: staticKey<string>('open_telemetry.tracing.jaeger_exporter.endpoint')
      }
    }
  },
  TRENDING: {
    VIDEOS: {
      INTERVAL_DAYS: staticKey<number>('trending.videos.interval_days'),
      ALGORITHMS: {
        ENABLED: dynamicKey<string[]>('trending.videos.algorithms.enabled'),
        DEFAULT: dynamicKey<string>('trending.videos.algorithms.default')
      }
    }
  },
  REDUNDANCY: {
    VIDEOS: {
      CHECK_INTERVAL: staticKey('redundancy.videos.check_interval', { transform: parseDurationToMs }),
      STRATEGIES: staticKey('redundancy.videos.strategies', { transform: buildVideosRedundancy })
    }
  },
  REMOTE_REDUNDANCY: {
    VIDEOS: {
      ACCEPT_FROM: staticKey<VideoRedundancyConfigFilter>('remote_redundancy.videos.accept_from')
    }
  },
  CSP: {
    ENABLED: staticKey<boolean>('csp.enabled'),
    REPORT_ONLY: staticKey<boolean>('csp.report_only'),
    REPORT_URI: staticKey<string>('csp.report_uri')
  },
  SECURITY: {
    FRAMEGUARD: {
      ENABLED: staticKey<boolean>('security.frameguard.enabled')
    },
    POWERED_BY_HEADER: {
      ENABLED: staticKey<boolean>('security.powered_by_header.enabled')
    }
  },
  TRACKER: {
    ENABLED: staticKey<boolean>('tracker.enabled'),
    PRIVATE: staticKey<boolean>('tracker.private'),
    REJECT_TOO_MANY_ANNOUNCES: staticKey<boolean>('tracker.reject_too_many_announces')
  },
  HISTORY: {
    VIDEOS: {
      MAX_AGE: staticKey('history.videos.max_age', { transform: parseDurationToMs })
    }
  },
  VIEWS: {
    VIDEOS: {
      REMOTE: {
        MAX_AGE: staticKey('views.videos.remote.max_age', { transform: parseDurationToMs })
      },
      LOCAL: {
        MAX_AGE: staticKey('views.videos.local.max_age', { transform: parseDurationToMs })
      },
      LOCAL_BUFFER_UPDATE_INTERVAL: staticKey('views.videos.local_buffer_update_interval', { transform: parseDurationToMs }),
      VIEW_EXPIRATION: staticKey('views.videos.view_expiration', { transform: parseDurationToMs }),
      COUNT_VIEW_AFTER: staticKey('views.videos.count_view_after', { transform: parseDurationToMs }),
      TRUST_VIEWER_SESSION_ID: staticKey<boolean>('views.videos.trust_viewer_session_id'),
      WATCHING_INTERVAL: {
        ANONYMOUS: staticKey('views.videos.watching_interval.anonymous', { transform: parseDurationToMs }),
        USERS: staticKey('views.videos.watching_interval.users', { transform: parseDurationToMs })
      }
    }
  },
  GEO_IP: {
    ENABLED: staticKey<boolean>('geo_ip.enabled'),
    COUNTRY: {
      DATABASE_URL: staticKey<string>('geo_ip.country.database_url')
    },
    CITY: {
      DATABASE_URL: staticKey<string>('geo_ip.city.database_url')
    }
  },
  PLUGINS: {
    INDEX: {
      ENABLED: staticKey<boolean>('plugins.index.enabled'),
      CHECK_LATEST_VERSIONS_INTERVAL: staticKey('plugins.index.check_latest_versions_interval', { transform: parseDurationToMs }),
      URL: staticKey<string>('plugins.index.url')
    }
  },
  FEDERATION: {
    ENABLED: staticKey<boolean>('federation.enabled'),
    PREVENT_SSRF: staticKey<boolean>('federation.prevent_ssrf'),
    VIDEOS: {
      FEDERATE_UNLISTED: staticKey<boolean>('federation.videos.federate_unlisted'),
      CLEANUP_REMOTE_INTERACTIONS: staticKey<boolean>('federation.videos.cleanup_remote_interactions')
    },
    SIGN_FEDERATED_FETCHES: staticKey<boolean>('federation.sign_federated_fetches')
  },
  PEERTUBE: {
    CHECK_LATEST_VERSION: {
      ENABLED: staticKey<boolean>('peertube.check_latest_version.enabled'),
      URL: staticKey<string>('peertube.check_latest_version.url')
    }
  },
  WEBADMIN: {
    CONFIGURATION: {
      EDITION: {
        ALLOWED: staticKey<boolean>('webadmin.configuration.edition.allowed')
      }
    }
  },
  FEEDS: {
    VIDEOS: {
      COUNT: staticKey<number>('feeds.videos.count')
    },
    COMMENTS: {
      COUNT: staticKey<number>('feeds.comments.count')
    }
  },
  REMOTE_RUNNERS: {
    STALLED_JOBS: {
      LIVE: staticKey('remote_runners.stalled_jobs.live', { transform: parseDurationToMs }),
      VOD: staticKey('remote_runners.stalled_jobs.vod', { transform: parseDurationToMs }),
      STUDIO: staticKey('remote_runners.stalled_jobs.studio', { transform: parseDurationToMs }),
      TRANSCRIPTION: staticKey('remote_runners.stalled_jobs.transcription', { transform: parseDurationToMs })
    }
  },
  THUMBNAILS: {
    GENERATION_FROM_VIDEO: {
      FRAMES_TO_ANALYZE: staticKey<number>('thumbnails.generation_from_video.frames_to_analyze')
    },
    SIZES: staticComputed([ 'thumbnails.sizes' ], () => {
      return sortBy(config.get<{ width: number, height: number, aspect_ratio?: ThumbnailAspectRatio }[]>('thumbnails.sizes'), 'width')
        .map(size => ({
          width: size.width,
          height: size.height,
          aspectRatio: size.aspect_ratio || guessAspectRatio(size.width, size.height)
        }))
    })
  },
  STATS: {
    REGISTRATION_REQUESTS: {
      ENABLED: staticKey<boolean>('stats.registration_requests.enabled')
    },
    ABUSES: {
      ENABLED: staticKey<boolean>('stats.abuses.enabled')
    },
    TOTAL_MODERATORS: {
      ENABLED: staticKey<boolean>('stats.total_moderators.enabled')
    },
    TOTAL_ADMINS: {
      ENABLED: staticKey<boolean>('stats.total_admins.enabled')
    }
  },
  WEBRTC: {
    STUN_SERVERS: staticKey<string[]>('webrtc.stun_servers')
  },
  ADMIN: {
    EMAIL: dynamicKey<string>('admin.email')
  },
  CONTACT_FORM: {
    ENABLED: dynamicKey<boolean>('contact_form.enabled')
  },
  SIGNUP: {
    ENABLED: dynamicKey<boolean>('signup.enabled'),
    REQUIRES_APPROVAL: dynamicKey<boolean>('signup.requires_approval'),
    LIMIT: dynamicKey<number>('signup.limit'),
    REQUIRES_EMAIL_VERIFICATION: dynamicKey<boolean>('signup.requires_email_verification'),
    MINIMUM_AGE: dynamicKey<number>('signup.minimum_age'),

    FILTERS: {
      CIDR: {
        WHITELIST: dynamicKey<string[]>('signup.filters.cidr.whitelist'),
        BLACKLIST: dynamicKey<string[]>('signup.filters.cidr.blacklist')
      }
    }
  },
  USER: {
    HISTORY: {
      VIDEOS: {
        ENABLED: dynamicKey<boolean>('user.history.videos.enabled')
      }
    },
    DISABLE_ROOT_AUTH: dynamicKey<boolean>('user.disable_root_auth'),
    ALLOW_CROSS_PROVIDER_AUTH: dynamicKey<boolean>('user.allow_cross_provider_auth'),
    VIDEO_QUOTA: dynamicKey('user.video_quota', { transform: parseBytes }),
    VIDEO_QUOTA_DAILY: dynamicKey('user.video_quota_daily', { transform: parseBytes }),
    DEFAULT_CHANNEL_NAME: dynamicKey<string>('user.default_channel_name'),
    PASSWORD_CONSTRAINTS: {
      MIN_LENGTH: dynamicKey<number>('user.password_constraints.min_length')
    }
  },
  VIDEO_CHANNELS: {
    MAX_PER_USER: dynamicKey<number>('video_channels.max_per_user'),
    MAX_COLLABORATORS_PER_CHANNEL: dynamicKey<number>('video_channels.max_collaborators_per_channel')
  },
  TRANSCODING: {
    ENABLED: dynamicKey<boolean>('transcoding.enabled'),
    ORIGINAL_FILE: {
      KEEP: dynamicKey<boolean>('transcoding.original_file.keep')
    },
    ALLOW_ADDITIONAL_EXTENSIONS: dynamicKey<boolean>('transcoding.allow_additional_extensions'),
    ALLOW_AUDIO_FILES: dynamicKey<boolean>('transcoding.allow_audio_files'),
    THREADS: dynamicKey<number>('transcoding.threads'),
    CONCURRENCY: dynamicKey<number>('transcoding.concurrency'),
    PROFILE: dynamicKey<string>('transcoding.profile'),
    ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION: dynamicKey<boolean>('transcoding.always_transcode_original_resolution'),
    ALWAYS_TRANSCODE_PODCAST_OPTIMIZED_AUDIO: dynamicKey<boolean>('transcoding.always_transcode_podcast_optimized_audio'),
    RESOLUTIONS: {
      '0p': dynamicKey<boolean>('transcoding.resolutions.0p'),
      '144p': dynamicKey<boolean>('transcoding.resolutions.144p'),
      '240p': dynamicKey<boolean>('transcoding.resolutions.240p'),
      '360p': dynamicKey<boolean>('transcoding.resolutions.360p'),
      '480p': dynamicKey<boolean>('transcoding.resolutions.480p'),
      '720p': dynamicKey<boolean>('transcoding.resolutions.720p'),
      '1080p': dynamicKey<boolean>('transcoding.resolutions.1080p'),
      '1440p': dynamicKey<boolean>('transcoding.resolutions.1440p'),
      '2160p': dynamicKey<boolean>('transcoding.resolutions.2160p')
    },
    FPS: {
      MAX: dynamicKey<number>('transcoding.fps.max')
    },
    HLS: {
      ENABLED: dynamicKey<boolean>('transcoding.hls.enabled'),
      SPLIT_AUDIO_AND_VIDEO: dynamicKey<boolean>('transcoding.hls.split_audio_and_video')
    },
    WEB_VIDEOS: {
      ENABLED: dynamicKey<boolean>('transcoding.web_videos.enabled')
    },
    REMOTE_RUNNERS: {
      ENABLED: dynamicKey<boolean>('transcoding.remote_runners.enabled')
    }
  },
  LIVE: {
    ENABLED: dynamicKey<boolean>('live.enabled'),

    MAX_DURATION: dynamicKey('live.max_duration', { transform: parseDurationToMs }),
    MAX_INSTANCE_LIVES: dynamicKey<number>('live.max_instance_lives'),
    MAX_USER_LIVES: dynamicKey<number>('live.max_user_lives'),

    ALLOW_REPLAY: dynamicKey<boolean>('live.allow_replay'),

    DVR: {
      MAX_WINDOW: dynamicComputed([ 'live.dvr.max_window' ], () => { // In seconds
        const value = config.get<string>('live.dvr.max_window')
        if (typeof value === 'number') return value

        return Math.round(parseDurationToMs(value) / 1000)
      })
    },

    LATENCY_SETTING: {
      ENABLED: dynamicKey<boolean>('live.latency_setting.enabled')
    },

    RTMP: {
      ENABLED: dynamicKey<boolean>('live.rtmp.enabled'),
      PORT: dynamicKey<number>('live.rtmp.port'),
      HOSTNAME: dynamicKey<number>('live.rtmp.hostname'),
      PUBLIC_HOSTNAME: dynamicKey<number>('live.rtmp.public_hostname')
    },

    RTMPS: {
      ENABLED: dynamicKey<boolean>('live.rtmps.enabled'),
      PORT: dynamicKey<number>('live.rtmps.port'),
      HOSTNAME: dynamicKey<number>('live.rtmps.hostname'),
      PUBLIC_HOSTNAME: dynamicKey<number>('live.rtmps.public_hostname'),
      KEY_FILE: dynamicKey<string>('live.rtmps.key_file'),
      CERT_FILE: dynamicKey<string>('live.rtmps.cert_file')
    },

    TRANSCODING: {
      ENABLED: dynamicKey<boolean>('live.transcoding.enabled'),
      THREADS: dynamicKey<number>('live.transcoding.threads'),
      PROFILE: dynamicKey<string>('live.transcoding.profile'),

      ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION: dynamicKey<boolean>('live.transcoding.always_transcode_original_resolution'),

      RESOLUTIONS: {
        '0p': dynamicKey<boolean>('live.transcoding.resolutions.0p'),
        '144p': dynamicKey<boolean>('live.transcoding.resolutions.144p'),
        '240p': dynamicKey<boolean>('live.transcoding.resolutions.240p'),
        '360p': dynamicKey<boolean>('live.transcoding.resolutions.360p'),
        '480p': dynamicKey<boolean>('live.transcoding.resolutions.480p'),
        '720p': dynamicKey<boolean>('live.transcoding.resolutions.720p'),
        '1080p': dynamicKey<boolean>('live.transcoding.resolutions.1080p'),
        '1440p': dynamicKey<boolean>('live.transcoding.resolutions.1440p'),
        '2160p': dynamicKey<boolean>('live.transcoding.resolutions.2160p')
      },

      FPS: {
        MAX: dynamicKey<number>('live.transcoding.fps.max')
      },

      REMOTE_RUNNERS: {
        ENABLED: dynamicKey<boolean>('live.transcoding.remote_runners.enabled')
      }
    }
  },
  VIDEO_STUDIO: {
    ENABLED: dynamicKey<boolean>('video_studio.enabled'),
    REMOTE_RUNNERS: {
      ENABLED: dynamicKey<boolean>('video_studio.remote_runners.enabled')
    }
  },
  VIDEO_FILE: {
    UPDATE: {
      ENABLED: dynamicKey<boolean>('video_file.update.enabled')
    }
  },
  VIDEO_TRANSCRIPTION: {
    ENABLED: dynamicKey<boolean>('video_transcription.enabled'),
    ENGINE: dynamicKey<TranscriptionEngineName>('video_transcription.engine'),
    ENGINE_PATH: dynamicKey<string>('video_transcription.engine_path'),
    MODEL: dynamicKey<WhisperBuiltinModelName>('video_transcription.model'),
    MODEL_PATH: dynamicKey<string>('video_transcription.model_path'),
    TIMEOUT: dynamicKey('video_transcription.timeout', { transform: parseDurationToMs }),
    REMOTE_RUNNERS: {
      ENABLED: dynamicKey<boolean>('video_transcription.remote_runners.enabled')
    }
  },
  IMPORT: {
    VIDEOS: {
      CONCURRENCY: dynamicKey<number>('import.videos.concurrency'),
      TIMEOUT: dynamicKey('import.videos.timeout', { transform: parseDurationToMs }),
      MAX_ATTEMPTS: dynamicKey<number>('import.videos.max_attempts'),

      HTTP: {
        ENABLED: dynamicKey<boolean>('import.videos.http.enabled'),

        YOUTUBE_DL_RELEASE: {
          URL: dynamicKey<string>('import.videos.http.youtube_dl_release.url'),
          NAME: dynamicKey<string>('import.videos.http.youtube_dl_release.name'),
          PYTHON_PATH: dynamicKey<string>('import.videos.http.youtube_dl_release.python_path')
        },

        FORCE_IPV4: dynamicKey<boolean>('import.videos.http.force_ipv4'),

        PROXIES: dynamicKey<string[]>('import.videos.http.proxies'),

        COOKIES: {
          ENABLED: dynamicKey<boolean>('import.videos.http.cookies.enabled')
        }
      },
      TORRENT: {
        ENABLED: dynamicKey<boolean>('import.videos.torrent.enabled')
      }
    },
    VIDEO_CHANNEL_SYNCHRONIZATION: {
      ENABLED: dynamicKey<boolean>('import.video_channel_synchronization.enabled'),
      MAX_PER_USER: dynamicKey<number>('import.video_channel_synchronization.max_per_user'),
      CHECK_INTERVAL: dynamicKey('import.video_channel_synchronization.check_interval', { transform: parseDurationToMs }),
      VIDEOS_LIMIT_PER_SYNCHRONIZATION: dynamicKey<number>('import.video_channel_synchronization.videos_limit_per_synchronization'),
      FULL_SYNC_VIDEOS_LIMIT: dynamicKey<number>('import.video_channel_synchronization.full_sync_videos_limit')
    },
    USERS: {
      ENABLED: dynamicKey<boolean>('import.users.enabled')
    }
  },
  EXPORT: {
    USERS: {
      ENABLED: dynamicKey<boolean>('export.users.enabled'),
      MAX_USER_VIDEO_QUOTA: dynamicKey('export.users.max_user_video_quota', { transform: parseBytes }),
      EXPORT_EXPIRATION: dynamicKey('export.users.export_expiration', { transform: parseDurationToMs })
    }
  },
  AUTO_BLACKLIST: {
    VIDEOS: {
      OF_USERS: {
        ENABLED: dynamicKey<boolean>('auto_blacklist.videos.of_users.enabled')
      }
    }
  },
  INSTANCE: {
    NAME: dynamicKey<string>('instance.name'),
    SHORT_DESCRIPTION: dynamicKey<string>('instance.short_description'),
    DESCRIPTION: dynamicKey<string>('instance.description'),
    TERMS: dynamicKey<string>('instance.terms'),
    CODE_OF_CONDUCT: dynamicKey<string>('instance.code_of_conduct'),

    CREATION_REASON: dynamicKey<string>('instance.creation_reason'),

    MODERATION_INFORMATION: dynamicKey<string>('instance.moderation_information'),
    ADMINISTRATOR: dynamicKey<string>('instance.administrator'),
    MAINTENANCE_LIFETIME: dynamicKey<string>('instance.maintenance_lifetime'),
    BUSINESS_MODEL: dynamicKey<string>('instance.business_model'),
    HARDWARE_INFORMATION: dynamicKey<string>('instance.hardware_information'),

    DEFAULT_LANGUAGE: dynamicKey<string>('instance.default_language'),
    LANGUAGES: dynamicComputed([ 'instance.languages' ], () => config.get<string[]>('instance.languages') || []),
    CATEGORIES: dynamicComputed([ 'instance.categories' ], () => config.get<number[]>('instance.categories') || []),

    IS_NSFW: dynamicKey<boolean>('instance.is_nsfw'),
    DEFAULT_NSFW_POLICY: dynamicKey<NSFWPolicyType>('instance.default_nsfw_policy'),

    SERVER_COUNTRY: dynamicKey<string>('instance.server_country'),

    SUPPORT: {
      TEXT: dynamicKey<string>('instance.support.text')
    },

    SOCIAL: {
      EXTERNAL_LINK: dynamicKey<string>('instance.social.external_link'),
      MASTODON_LINK: dynamicKey<string>('instance.social.mastodon_link'),
      BLUESKY: dynamicKey<string>('instance.social.bluesky_link'),
      X_LINK: dynamicKey<string>('instance.social.x_link')
    },

    DEFAULT_CLIENT_ROUTE: dynamicKey<string>('instance.default_client_route'),

    CUSTOMIZATIONS: {
      JAVASCRIPT: dynamicKey<string>('instance.customizations.javascript'),
      CSS: dynamicKey<string>('instance.customizations.css')
    },
    ROBOTS: dynamicKey<string>('instance.robots'),
    SECURITYTXT: dynamicKey<string>('instance.securitytxt')
  },
  SERVICES: {
    TWITTER: {
      USERNAME: dynamicKey<string>('services.twitter.username')
    }
  },
  FOLLOWERS: {
    INSTANCE: {
      ENABLED: dynamicKey<boolean>('followers.instance.enabled'),
      MANUAL_APPROVAL: dynamicKey<boolean>('followers.instance.manual_approval')
    },
    CHANNELS: {
      ENABLED: dynamicKey<boolean>('followers.channels.enabled')
    }
  },
  FOLLOWINGS: {
    INSTANCE: {
      AUTO_FOLLOW_BACK: {
        ENABLED: dynamicKey<boolean>('followings.instance.auto_follow_back.enabled')
      },
      AUTO_FOLLOW_INDEX: {
        ENABLED: dynamicKey<boolean>('followings.instance.auto_follow_index.enabled'),
        INDEX_URL: dynamicKey<string>('followings.instance.auto_follow_index.index_url')
      }
    }
  },
  THEME: {
    DEFAULT: dynamicKey<string>('theme.default'),

    CUSTOMIZATION: {
      PRIMARY_COLOR: dynamicKey<string>('theme.customization.primary_color'),
      ON_PRIMARY_COLOR: dynamicKey<string>('theme.customization.on_primary_color'),
      FOREGROUND_COLOR: dynamicKey<string>('theme.customization.foreground_color'),
      BACKGROUND_COLOR: dynamicKey<string>('theme.customization.background_color'),
      BACKGROUND_SECONDARY_COLOR: dynamicKey<string>('theme.customization.background_secondary_color'),
      MENU_FOREGROUND_COLOR: dynamicKey<string>('theme.customization.menu_foreground_color'),
      MENU_BACKGROUND_COLOR: dynamicKey<string>('theme.customization.menu_background_color'),
      MENU_BORDER_RADIUS: dynamicKey<string>('theme.customization.menu_border_radius'),
      HEADER_BACKGROUND_COLOR: dynamicKey<string>('theme.customization.header_background_color'),
      HEADER_FOREGROUND_COLOR: dynamicKey<string>('theme.customization.header_foreground_color'),
      INPUT_BORDER_RADIUS: dynamicKey<string>('theme.customization.input_border_radius')
    }
  },
  BROADCAST_MESSAGE: {
    ENABLED: dynamicKey<boolean>('broadcast_message.enabled'),
    MESSAGE: dynamicKey<string>('broadcast_message.message'),
    LEVEL: dynamicKey<BroadcastMessageLevel>('broadcast_message.level'),
    DISMISSABLE: dynamicKey<boolean>('broadcast_message.dismissable')
  },
  SEARCH: {
    REMOTE_URI: {
      USERS: dynamicKey<boolean>('search.remote_uri.users'),
      ANONYMOUS: dynamicKey<boolean>('search.remote_uri.anonymous')
    },
    SEARCH_INDEX: {
      ENABLED: dynamicKey<boolean>('search.search_index.enabled'),
      URL: dynamicKey<string>('search.search_index.url'),
      DISABLE_LOCAL_SEARCH: dynamicKey<boolean>('search.search_index.disable_local_search'),
      IS_DEFAULT_SEARCH: dynamicKey<boolean>('search.search_index.is_default_search')
    }
  },
  STORYBOARDS: {
    ENABLED: dynamicKey<boolean>('storyboards.enabled'),
    REMOTE_RUNNERS: {
      ENABLED: dynamicKey<boolean>('storyboards.remote_runners.enabled')
    }
  },
  EMAIL: {
    BODY: {
      SIGNATURE: dynamicKey<string>('email.body.signature')
    },
    SUBJECT: {
      PREFIX: dynamicKey<string>('email.subject.prefix')
    }
  },
  VIDEO_COMMENTS: {
    ACCEPT_REMOTE_COMMENTS: dynamicKey<boolean>('video_comments.accept_remote_comments')
  }
})

export function registerConfigChangedHandler (fun: Function) {
  configChangedHandlers.push(fun)
}

// ---------------------------------------------------------------------------
// Private
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

// ---------------------------------------------------------------------------

function staticKey<T> (property: string, options?: ConfigKeyOptions<T>) {
  return buildKey<T>('static', property, options)
}

function dynamicKey<T> (property: string, options?: ConfigKeyOptions<T>) {
  return buildKey<T>('dynamic', property, options)
}

// For the few values built from more than one key, or with a computation the helpers above cannot express
function staticComputed<T> (properties: string[], read: () => T): ConfigKey<T> {
  return { tier: 'static', properties, read }
}

function dynamicComputed<T> (properties: string[], read: () => T): ConfigKey<T> {
  return { tier: 'dynamic', properties, read }
}

function buildKey<T> (tier: ConfigTier, property: string, options: ConfigKeyOptions<T> = {}): ConfigKey<T> {
  const { transform } = options

  return {
    tier,
    properties: [ property ],

    read: () => {
      const value = config.get<any>(property)

      return transform
        ? transform(value)
        : value
    }
  }
}

// ---------------------------------------------------------------------------

function buildConfig<S extends ConfigSpec> (spec: S): BuiltConfig<S> {
  const result: any = {}

  for (const [ name, value ] of Object.entries(spec)) {
    if (isConfigKey(value)) {
      for (const property of value.properties) {
        CONFIG_TIERS[property] = value.tier
      }

      // `configurable` and `writable` so tests can stub a configuration value
      if (value.tier === 'static') {
        // Read now, exactly like the plain property it replaces
        Object.defineProperty(result, name, {
          value: value.read(),
          enumerable: true,
          configurable: true,
          writable: true
        })
      } else {
        Object.defineProperty(result, name, {
          get: value.read,
          enumerable: true,
          configurable: true
        })
      }

      continue
    }

    result[name] = value !== null && typeof value === 'object'
      ? buildConfig(value as ConfigSpec)
      : value
  }

  return result
}

function isConfigKey (value: any): value is ConfigKey<any> {
  return !!value &&
    typeof value === 'object' &&
    typeof value.read === 'function' &&
    typeof value.tier === 'string'
}
