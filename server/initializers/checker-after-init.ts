import config from 'config'
import { URL } from 'url'
import { getFFmpegVersion } from '@server/helpers/ffmpeg'
import { uniqify } from '@shared/core-utils'
import { VideoRedundancyConfigFilter } from '@shared/models/redundancy/video-redundancy-config-filter.type'
import { RecentlyAddedStrategy } from '../../shared/models/redundancy'
import { isProdInstance, parseBytes, parseSemVersion } from '../helpers/core-utils'
import { isArray } from '../helpers/custom-validators/misc'
import { logger } from '../helpers/logger'
import { ApplicationModel, getServerActor } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { UserModel } from '../models/user/user'
import { CONFIG, isEmailEnabled } from './config'
import { WEBSERVER } from './constants'

async function checkActivityPubUrls () {
  const actor = await getServerActor()

  const parsed = new URL(actor.url)
  if (WEBSERVER.HOST !== parsed.host) {
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

  const configFiles = config.util.getConfigSources().map(s => s.name).join(' -> ')
  logger.info('Using following configuration file hierarchy: %s.', configFiles)

  // Moved configuration keys
  if (config.has('services.csp-logger')) {
    logger.warn('services.csp-logger configuration has been renamed to csp.report_uri. Please update your configuration file.')
  }

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

async function checkFFmpegVersion () {
  const version = await getFFmpegVersion()
  const { major, minor, patch } = parseSemVersion(version)

  if (major < 4 || (major === 4 && minor < 1)) {
    logger.warn('Your ffmpeg version (%s) is outdated. PeerTube supports ffmpeg >= 4.1. Please upgrade ffmpeg.', version)
  }

  if (major === 4 && minor === 4 && patch === 0) {
    logger.warn('There is a bug in ffmpeg 4.4.0 with HLS videos. Please upgrade ffmpeg.')
  }
}

// ---------------------------------------------------------------------------

export {
  checkConfig,
  clientsExist,
  checkFFmpegVersion,
  usersExist,
  applicationExist,
  checkActivityPubUrls
}

// ---------------------------------------------------------------------------

function checkSecretsConfig () {
  if (!CONFIG.SECRETS.PEERTUBE) {
    throw new Error('secrets.peertube is missing in config. Generate one using `openssl rand -hex 32`')
  }
}

function checkEmailConfig () {
  if (!isEmailEnabled()) {
    if (CONFIG.SIGNUP.ENABLED && CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
      throw new Error('Emailer is disabled but you require signup email verification.')
    }

    if (CONFIG.SIGNUP.ENABLED && CONFIG.SIGNUP.REQUIRES_APPROVAL) {
      // eslint-disable-next-line max-len
      logger.warn('Emailer is disabled but signup approval is enabled: PeerTube will not be able to send an email to the user upon acceptance/rejection of the registration request')
    }

    if (CONFIG.CONTACT_FORM.ENABLED) {
      logger.warn('Emailer is disabled so the contact form will not work.')
    }
  }
}

function checkNSFWPolicyConfig () {
  const defaultNSFWPolicy = CONFIG.INSTANCE.DEFAULT_NSFW_POLICY

  const available = [ 'do_not_list', 'blur', 'display' ]
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

    const recentlyAddedStrategy = redundancyVideos.find(r => r.strategy === 'recently-added') as RecentlyAddedStrategy
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
    const configStorage = config.get<{ [ name: string ]: string }>('storage')

    for (const key of Object.keys(configStorage)) {
      if (configStorage[key].startsWith('storage/')) {
        logger.warn(
          'Directory of %s should not be in the production directory of PeerTube. Please check your production configuration file.',
          key
        )
      }
    }
  }

  if (CONFIG.STORAGE.VIDEOS_DIR === CONFIG.STORAGE.REDUNDANCY_DIR) {
    logger.warn('Redundancy directory should be different than the videos folder.')
  }
}

function checkTranscodingConfig () {
  if (CONFIG.TRANSCODING.ENABLED) {
    if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false && CONFIG.TRANSCODING.HLS.ENABLED === false) {
      throw new Error('You need to enable at least WebTorrent transcoding or HLS transcoding.')
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

    if (CONFIG.LIVE.USE_OBJECT_STORAGE === true && !CONFIG.OBJECT_STORAGE.ENABLED) {
      throw new Error('Live streaming cannot use object storage if object storage is not enabled.')
    }

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

function checkObjectStorageConfig () {
  if (CONFIG.OBJECT_STORAGE.ENABLED === true) {

    if (!CONFIG.OBJECT_STORAGE.VIDEOS.BUCKET_NAME) {
      throw new Error('videos_bucket should be set when object storage support is enabled.')
    }

    if (!CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BUCKET_NAME) {
      throw new Error('streaming_playlists_bucket should be set when object storage support is enabled.')
    }

    if (
      CONFIG.OBJECT_STORAGE.VIDEOS.BUCKET_NAME === CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BUCKET_NAME &&
      CONFIG.OBJECT_STORAGE.VIDEOS.PREFIX === CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.PREFIX
    ) {
      if (CONFIG.OBJECT_STORAGE.VIDEOS.PREFIX === '') {
        throw new Error('Object storage bucket prefixes should be set when the same bucket is used for both types of video.')
      }

      throw new Error(
        'Object storage bucket prefixes should be set to different values when the same bucket is used for both types of video.'
      )
    }

    if (CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART > parseBytes('250MB')) {
      // eslint-disable-next-line max-len
      logger.warn(`Object storage max upload part seems to have a big value (${CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART} bytes). Consider using a lower one (like 100MB).`)
    }
  }
}

function checkVideoStudioConfig () {
  if (CONFIG.VIDEO_STUDIO.ENABLED === true && CONFIG.TRANSCODING.ENABLED === false) {
    throw new Error('Video studio cannot be enabled if transcoding is disabled')
  }
}
