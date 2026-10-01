import { uniqify } from '@peertube/peertube-core-utils'
import { getFFmpegVersion } from '@peertube/peertube-ffmpeg'
import { VideoRedundancyConfigFilter } from '@peertube/peertube-models'
import { isProdInstance, parseBytes, parseSemVersion } from '@peertube/peertube-node-utils'
import { isTrackerUrlValid, isWebSocketTrackerUrl } from '@server/helpers/custom-validators/urls.js'
import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { URL } from 'url'
import { getBrowseVideosDefaultScopeError, getBrowseVideosDefaultSortError } from '../helpers/custom-validators/browse-videos.js'
import { isArray } from '../helpers/custom-validators/misc.js'
import { createLogger } from '../helpers/logger.js'
import {
  getObjectStorageFileConfig,
  getPrunableObjectStorageLocationConflicts,
  objectStorageSections
} from '../lib/object-storage/config.js'
import { LOCAL_TRACKER_URLS_KEYWORD } from '../lib/tracker-urls.js'
import { checkVideoFilesLifecycleConfig } from '../lib/video-files-lifecycle/video-files-lifecycle-config.js'
import { ApplicationModel, getServerActor } from '../models/application/application.js'
import { OAuthClientModel } from '../models/oauth/oauth-client.js'
import { UserModel } from '../models/user/user.js'
import { CONFIG, getConfigModule, getLocalConfigFilePath, isEmailEnabled, reloadConfig } from './config.js'
import { OBJECT_STORAGE_STAGING, WEBSERVER } from './constants.js'

const logger = createLogger()

async function checkActivityPubUrls () {
  const actor = await getServerActor()

  const parsed = new URL(actor.url)
  if (WEBSERVER.HOST !== parsed.host) {
    const config = getConfigModule()

    const NODE_ENV = config.util.getEnv('NODE_ENV')
    const NODE_CONFIG_DIR = config.util.getEnv('NODE_CONFIG_DIR')

    logger.warn(
      'It seems PeerTube was started (and created some data) with another domain name. ' +
        'This means you will not be able to federate! ' +
        'Please use %s %s npm run update-host to fix this.',
      NODE_CONFIG_DIR ? `NODE_CONFIG_DIR=${NODE_CONFIG_DIR}` : '',
      NODE_ENV ? `NODE_ENV=${NODE_ENV}` : ''
    )
  }
}

// Some checks on configuration files or throw if there is an error
function checkConfig () {
  const configFiles = getConfigModule().util.getConfigSources().map(s => s.name).join(' -> ')
  logger.info('Using following configuration file hierarchy: %s.', configFiles)

  checkRemovedConfigKeys()

  checkSecretsConfig()
  checkEmailConfig()
  checkNSFWPolicyConfig()
  checkLocalRedundancyConfig()
  checkRemoteRedundancyConfig()
  checkStorageConfig()
  checkTranscodingConfig()
  checkImportConfig()
  checkBroadcastMessageConfig()
  checkSearchConfig()
  checkLiveConfig()
  checkObjectStorageConfig()
  checkVideoStudioConfig()
  checkVideoFilesLifecycleConfig()
  checkThumbnailsConfig()
  checkBrowseVideosConfig()
  checkTrackerConfig()
}

// We get db by param to not import it in this file (import orders)
async function clientsExist () {
  const totalClients = await OAuthClientModel.countTotal()

  return totalClients !== 0
}

// We get db by param to not import it in this file (import orders)
async function usersExist () {
  const totalUsers = await UserModel.countTotal()

  return totalUsers !== 0
}

// We get db by param to not import it in this file (import orders)
async function applicationExist () {
  const totalApplication = await ApplicationModel.countTotal()

  return totalApplication !== 0
}

const BUCKET_CHECK_TIMEOUT_MS = 10000

// Throws if a bucket does not exist, only logs other errors (network, permissions, timeout...) that may be transient
async function checkObjectStorageBucketsConnectivity () {
  if (CONFIG.OBJECT_STORAGE.ENABLED !== true) return

  const { HeadBucketCommand } = await import('@aws-sdk/client-s3')
  const { getClient } = await import('../lib/object-storage/shared/client.js')

  // Bucket name -> sections using it
  const buckets = new Map<string, string[]>()

  for (const name of getUsedObjectStorageSectionTypes()) {
    const bucketName = getObjectStorageFileConfig(name).BUCKET_NAME

    buckets.set(bucketName, [ ...(buckets.get(bucketName) ?? []), name ])
  }

  const client = await getClient()
  const missingBuckets: string[] = []

  await Promise.all([ ...buckets ].map(async ([ bucketName, sectionNames ]) => {
    const settingNames = sectionNames.map(name => `object_storage.${name}.bucket_name`).join(', ')

    try {
      // The S3 client has no request timeout: an unreachable endpoint must not block the startup
      await client.send(new HeadBucketCommand({ Bucket: bucketName }), { abortSignal: AbortSignal.timeout(BUCKET_CHECK_TIMEOUT_MS) })
    } catch (err) {
      if (isBucketNotFoundError(err)) {
        missingBuckets.push(` - ${bucketName}, used by ${settingNames}`)
        return
      }

      logger.error(
        'Cannot reach object storage bucket %s: storing files in it will fail. Check the %s setting.',
        bucketName,
        settingNames,
        { err }
      )
    }
  }))

  if (missingBuckets.length !== 0) {
    throw new Error(
      'These object storage buckets do not exist:\n' + missingBuckets.join('\n') + '\n' +
        'Create them on your object storage provider, or set these settings to existing buckets. ' +
        'Every kind of local file is stored in object storage when object_storage.enabled is true.'
    )
  }
}

function isBucketNotFoundError (err: any) {
  return err?.name === 'NoSuchBucket' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404
}

async function checkFFmpegVersion () {
  const version = await getFFmpegVersion()
  const semvar = parseSemVersion(version)

  if (!semvar) {
    logger.warn('Your ffmpeg version (%s) does not use semvar. Unable to determine version compatibility.', version)
    return
  }

  const { major, minor, patch } = semvar

  if (major < 4 || (major === 4 && minor < 1)) {
    logger.warn('Your ffmpeg version (%s) is outdated. PeerTube supports ffmpeg >= 4.1. Please upgrade ffmpeg.', version)
  }

  if (major === 4 && minor === 4 && patch === 0) {
    logger.warn('There is a bug in ffmpeg 4.4.0 with HLS videos. Please upgrade ffmpeg.')
  }
}

// ---------------------------------------------------------------------------

export {
  applicationExist,
  checkActivityPubUrls,
  checkConfig,
  checkFFmpegVersion,
  checkObjectStorageBucketsConnectivity,
  clientsExist,
  usersExist
}

// ---------------------------------------------------------------------------

function checkRemovedConfigKeys () {
  const config = getConfigModule()

  // Moved configuration keys
  if (config.has('services.csp-logger')) {
    logger.warn('services.csp-logger configuration has been renamed to csp.report_uri. Please update your configuration file.')
  }

  if (config.has('transcoding.webtorrent.enabled')) {
    const localConfigPath = getLocalConfigFilePath()

    const content = readFileSync(localConfigPath, { encoding: 'utf-8' })
    if (!content.includes('"webtorrent"')) {
      throw new Error('Please rename transcoding.webtorrent.enabled key to transcoding.web_videos.enabled in your configuration file')
    }

    try {
      logger.info(
        'Replacing "transcoding.webtorrent.enabled" key to "transcoding.web_videos.enabled" in your local configuration ' + localConfigPath
      )

      writeFileSync(localConfigPath, content.replace('"webtorrent"', '"web_videos"'), { encoding: 'utf-8' })

      reloadConfig()
        .catch(err => logger.error('Cannot reload configuration', { err }))
    } catch (err) {
      logger.error('Cannot write new configuration to file ' + localConfigPath, { err })
    }
  }
}

function checkSecretsConfig () {
  if (!CONFIG.SECRETS.PEERTUBE) {
    throw new Error('secrets.peertube is missing in config. Generate one using `openssl rand -hex 32`')
  }
}

function checkEmailConfig () {
  if (!isEmailEnabled()) {
    if (CONFIG.SIGNUP.ENABLED && CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
      logger.error('SMTP is not configured but you require signup email verification.')
    }

    if (CONFIG.SIGNUP.ENABLED && CONFIG.SIGNUP.REQUIRES_APPROVAL) {
      logger.warn(
        'SMTP is not configured but signup approval is enabled: ' +
          'PeerTube will not be able to send an email to the user upon acceptance/rejection of the registration request'
      )
    }

    if (CONFIG.CONTACT_FORM.ENABLED) {
      logger.warn('SMTP is not configured so the contact form will not work.')
    }
  }
}

function checkNSFWPolicyConfig () {
  const defaultNSFWPolicy = CONFIG.INSTANCE.DEFAULT_NSFW_POLICY

  const available = [ 'do_not_list', 'warn', 'blur', 'display' ]
  if (available.includes(defaultNSFWPolicy) === false) {
    throw new Error('NSFW policy setting should be ' + available.join(' or ') + ' instead of ' + defaultNSFWPolicy)
  }
}

function checkLocalRedundancyConfig () {
  const redundancyVideos = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES

  if (isArray(redundancyVideos)) {
    const available = [ 'most-views', 'trending', 'recently-added' ]

    for (const r of redundancyVideos) {
      if (available.includes(r.strategy) === false) {
        throw new Error('Videos redundancy should have ' + available.join(' or ') + ' strategy instead of ' + r.strategy)
      }

      // Lifetime should not be < 10 hours
      if (isProdInstance() && r.minLifetime < 1000 * 3600 * 10) {
        throw new Error('Video redundancy minimum lifetime should be >= 10 hours for strategy ' + r.strategy)
      }
    }

    const filtered = uniqify(redundancyVideos.map(r => r.strategy))
    if (filtered.length !== redundancyVideos.length) {
      throw new Error('Redundancy video entries should have unique strategies')
    }

    const recentlyAddedStrategy = redundancyVideos.find(r => r.strategy === 'recently-added')
    if (recentlyAddedStrategy && isNaN(recentlyAddedStrategy.minViews)) {
      throw new Error('Min views in recently added strategy is not a number')
    }
  } else {
    throw new Error('Videos redundancy should be an array (you must uncomment lines containing - too)')
  }
}

function checkRemoteRedundancyConfig () {
  const acceptFrom = CONFIG.REMOTE_REDUNDANCY.VIDEOS.ACCEPT_FROM
  const acceptFromValues = new Set<VideoRedundancyConfigFilter>([ 'nobody', 'anybody', 'followings' ])

  if (acceptFromValues.has(acceptFrom) === false) {
    throw new Error('remote_redundancy.videos.accept_from has an incorrect value')
  }
}

function checkStorageConfig () {
  // Check storage directory locations
  if (isProdInstance()) {
    const configStorage = getConfigModule().get<{ [name: string]: string }>('storage')

    for (const key of Object.keys(configStorage)) {
      if (configStorage[key].startsWith('storage/')) {
        logger.warn(
          'Directory of %s should not be in the production directory of PeerTube. Please check your production configuration file.',
          key
        )
      }
    }

    const webVideosDirname = basename(CONFIG.STORAGE.WEB_VIDEOS_DIR)
    if (webVideosDirname !== 'web-videos') {
      logger.warn(`storage.web_videos configuration should have a "web-videos" directory name (current value: "${webVideosDirname}")`)
    }
  }

  if (CONFIG.STORAGE.WEB_VIDEOS_DIR === CONFIG.STORAGE.REDUNDANCY_DIR) {
    logger.warn('Redundancy directory should be different than the videos folder.')
  }
}

function checkTranscodingConfig () {
  if (CONFIG.TRANSCODING.ENABLED) {
    if (CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED === false && CONFIG.TRANSCODING.HLS.ENABLED === false) {
      throw new Error('You need to enable at least Web Video transcoding or HLS transcoding.')
    }

    if (CONFIG.TRANSCODING.CONCURRENCY <= 0) {
      throw new Error('Transcoding concurrency should be > 0')
    }
  }

  if (CONFIG.IMPORT.VIDEOS.HTTP.ENABLED || CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED) {
    if (CONFIG.IMPORT.VIDEOS.CONCURRENCY <= 0) {
      throw new Error('Video import concurrency should be > 0')
    }
  }
}

function checkImportConfig () {
  if (CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED && !CONFIG.IMPORT.VIDEOS.HTTP) {
    throw new Error('You need to enable HTTP import to allow synchronization')
  }
}

function checkBroadcastMessageConfig () {
  if (CONFIG.BROADCAST_MESSAGE.ENABLED) {
    const currentLevel = CONFIG.BROADCAST_MESSAGE.LEVEL
    const available = [ 'info', 'warning', 'error' ]

    if (available.includes(currentLevel) === false) {
      throw new Error('Broadcast message level should be ' + available.join(' or ') + ' instead of ' + currentLevel)
    }
  }
}

function checkSearchConfig () {
  if (CONFIG.SEARCH.SEARCH_INDEX.ENABLED === true) {
    if (CONFIG.SEARCH.REMOTE_URI.USERS === false) {
      throw new Error('You cannot enable search index without enabling remote URI search for users.')
    }
  }
}

function checkLiveConfig () {
  if (CONFIG.LIVE.ENABLED === true) {
    if (CONFIG.LIVE.ALLOW_REPLAY === true && CONFIG.TRANSCODING.ENABLED === false) {
      throw new Error('Live allow replay cannot be enabled if transcoding is not enabled.')
    }

    if (CONFIG.LIVE.RTMP.ENABLED === false && CONFIG.LIVE.RTMPS.ENABLED === false) {
      throw new Error('You must enable at least RTMP or RTMPS')
    }

    if (CONFIG.LIVE.RTMPS.ENABLED) {
      if (!CONFIG.LIVE.RTMPS.KEY_FILE) {
        throw new Error('You must specify a key file to enable RTMPS')
      }

      if (!CONFIG.LIVE.RTMPS.CERT_FILE) {
        throw new Error('You must specify a cert file to enable RTMPS')
      }
    }
  }
}

// Original video files are only stored if the admin keeps them
function getUsedObjectStorageSectionTypes () {
  return objectStorageSections
    .filter(type => type !== 'original_video_files' || CONFIG.TRANSCODING.ORIGINAL_FILE.KEEP)
}

function checkObjectStorageConfig () {
  if (CONFIG.OBJECT_STORAGE.ENABLED !== true) return

  for (const name of getUsedObjectStorageSectionTypes()) {
    if (!getObjectStorageFileConfig(name).BUCKET_NAME) {
      throw new Error(`object_storage.${name}.bucket_name should be set when object storage support is enabled.`)
    }
  }

  const maxChunkSize = CONFIG.CLIENT.VIDEOS.RESUMABLE_UPLOAD.MAX_CHUNK_SIZE

  if (maxChunkSize && maxChunkSize < OBJECT_STORAGE_STAGING.MIN_PART_SIZE) {
    logger.warn(
      `client.videos.resumable_upload.max_chunk_size is lower than ${OBJECT_STORAGE_STAGING.MIN_PART_SIZE} bytes, the minimum object ` +
        'storage part size: resumable uploads streamed to object storage will use bigger chunks anyway.'
    )
  }

  for (const conflict of getPrunableObjectStorageLocationConflicts()) {
    logger.warn(`${conflict}. Set different bucket prefixes, otherwise the prune-storage script cannot be used.`)
  }

  if (CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART > parseBytes('250MB')) {
    logger.warn(
      `Object storage max upload part seems to have a big value (${CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART} bytes). ` +
        `Consider using a lower one (like 100MB).`
    )
  }
}

function checkVideoStudioConfig () {
  if (CONFIG.VIDEO_STUDIO.ENABLED === true && CONFIG.TRANSCODING.ENABLED === false) {
    throw new Error('Video studio cannot be enabled if transcoding is disabled')
  }
}

function checkThumbnailsConfig () {
  if (CONFIG.THUMBNAILS.GENERATION_FROM_VIDEO.FRAMES_TO_ANALYZE < 2) {
    throw new Error('thumbnails.generation_from_video.frames_to_analyze must be a number greater than 1')
  }

  if (!isArray(CONFIG.THUMBNAILS.SIZES) || CONFIG.THUMBNAILS.SIZES.length === 0) {
    throw new Error('thumbnails.sizes must not be empty')
  }

  // A video/playlist can only have one thumbnail of a given size
  const sizes = CONFIG.THUMBNAILS.SIZES.map(s => `${s.width}x${s.height}`)
  if (new Set(sizes).size !== sizes.length) {
    throw new Error('thumbnails.sizes must not contain multiple sizes with the same width and height')
  }
}

function checkTrackerConfig () {
  const urls = CONFIG.TRACKER.URLS

  if (!isArray(urls) || urls.length === 0) {
    throw new Error('tracker.urls must contain at least one URL or \'local\'. Set tracker.enabled to false to disable P2P')
  }

  for (const url of urls) {
    if (url === LOCAL_TRACKER_URLS_KEYWORD || isTrackerUrlValid(url)) continue

    throw new Error(`tracker.urls contains an invalid value: ${url}. Use 'local' or a ws://, wss://, http:// or https:// URL`)
  }

  // Web browsers block insecure websockets from an HTTPS page
  if (CONFIG.WEBSERVER.SCHEME === 'https') {
    const insecureWS = urls.find(u => u.startsWith('ws://'))

    if (insecureWS) {
      throw new Error(
        `tracker.urls contains ${insecureWS}: use wss:// instead, the web player cannot reach a ws:// tracker from an HTTPS instance`
      )
    }
  }

  if (!urls.some(u => u === LOCAL_TRACKER_URLS_KEYWORD || isWebSocketTrackerUrl(u))) {
    logger.warn('tracker.urls has no websocket tracker (\'local\' or a ws:// or wss:// URL): the web player will not find P2P peers.')
  }
}

function checkBrowseVideosConfig () {
  const sortError = getBrowseVideosDefaultSortError(CONFIG.CLIENT.BROWSE_VIDEOS.DEFAULT_SORT, CONFIG.TRENDING.VIDEOS.ALGORITHMS.ENABLED)
  if (sortError) throw new Error(sortError)

  const scopeError = getBrowseVideosDefaultScopeError(CONFIG.CLIENT.BROWSE_VIDEOS.DEFAULT_SCOPE)
  if (scopeError) throw new Error(scopeError)
}
