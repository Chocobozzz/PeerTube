import * as config from 'config'
import { isProdInstance, isTestInstance } from '../helpers/core-utils'
import { UserModel } from '../models/account/user'
import { ApplicationModel } from '../models/application/application'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { parse } from 'url'
import { CONFIG } from './constants'
import { logger } from '../helpers/logger'
import { getServerActor } from '../helpers/utils'
import { RecentlyAddedStrategy } from '../../shared/models/redundancy'
import { isArray } from '../helpers/custom-validators/misc'
import { uniq } from 'lodash'

async function checkActivityPubUrls () {
  const actor = await getServerActor()

  const parsed = parse(actor.url)
  if (CONFIG.WEBSERVER.HOST !== parsed.host) {
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

// Some checks on configuration files
// Return an error message, or null if everything is okay
function checkConfig () {
  const defaultNSFWPolicy = CONFIG.INSTANCE.DEFAULT_NSFW_POLICY

  // NSFW policy
  {
    const available = [ 'do_not_list', 'blur', 'display' ]
    if (available.indexOf(defaultNSFWPolicy) === -1) {
      return 'NSFW policy setting should be ' + available.join(' or ') + ' instead of ' + defaultNSFWPolicy
    }
  }

  // Redundancies
  const redundancyVideos = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES
  if (isArray(redundancyVideos)) {
    const available = [ 'most-views', 'trending', 'recently-added' ]
    for (const r of redundancyVideos) {
      if (available.indexOf(r.strategy) === -1) {
        return 'Videos redundancy should have ' + available.join(' or ') + ' strategy instead of ' + r.strategy
      }

      // Lifetime should not be < 10 hours
      if (!isTestInstance() && r.minLifetime < 1000 * 3600 * 10) {
        return 'Video redundancy minimum lifetime should be >= 10 hours for strategy ' + r.strategy
      }
    }

    const filtered = uniq(redundancyVideos.map(r => r.strategy))
    if (filtered.length !== redundancyVideos.length) {
      return 'Redundancy video entries should have unique strategies'
    }

    const recentlyAddedStrategy = redundancyVideos.find(r => r.strategy === 'recently-added') as RecentlyAddedStrategy
    if (recentlyAddedStrategy && isNaN(recentlyAddedStrategy.minViews)) {
      return 'Min views in recently added strategy is not a number'
    }
  }

  if (isProdInstance()) {
    const configStorage = config.get('storage')
    for (const key of Object.keys(configStorage)) {
      if (configStorage[key].startsWith('storage/')) {
        logger.warn(
          'Directory of %s should not be in the production directory of PeerTube. Please check your production configuration file.',
          key
        )
      }
    }
  }

  return null
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

// ---------------------------------------------------------------------------

export {
  checkConfig,
  clientsExist,
  usersExist,
  applicationExist,
  checkActivityPubUrls
}
