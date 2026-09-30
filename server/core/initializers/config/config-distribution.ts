import { hostname } from 'os'
import { createLogger } from '../../helpers/logger.js'
import { ClientHtml } from '../../lib/html/client-html.js'
import { Redis, RedisChannels } from '../../lib/redis/index.js'
import { CONFIG, getConfigModule, reloadConfig } from '../config.js'
import { WEBSERVER } from '../constants.js'
import { isSecondaryProcess } from '../process-role.js'
import { buildStorageDirectoriesPayload, findStorageDirectoriesConflictsWithPrimary } from '../storage-ownership.js'
import { buildPublishableConfig, decodePublishedConfig, encodePublishedConfig, setPublishedConfig } from './shared-config.js'

const logger = createLogger('config')

/**
 * The primary process publishes its whole config
 * All secondary processes read that value at boot and re-reads it on every notification
 */
export class ConfigDistribution {
  private static instance: ConfigDistribution

  private constructor () {}

  async init () {
    if (isSecondaryProcess()) {
      await RedisChannels.configChanged.subscribe(() => this.applyPublishedConfig())

      logger.info(`Using the configuration published by the primary process of ${WEBSERVER.HOST}.`)

      this.warnOnStorageDirectoriesUsedByPrimary()

      return
    }

    await this.publishOrThrow()
  }

  // Called by the primary after every admin configuration change
  async publish () {
    try {
      await this.publishOrThrow()
    } catch (err) {
      logger.error('Cannot publish the instance configuration to Redis.', { err })
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async publishOrThrow () {
    const payload = {
      instance: WEBSERVER.HOST,

      // The whole merged configuration, files and environment included
      config: buildPublishableConfig(getConfigModule().toObject()),

      // Published so a secondary on the same host can detect storage directory collisions
      hostname: hostname(),
      storage: buildStorageDirectoriesPayload()
    }

    await Redis.Instance.setSharedConfig(await encodePublishedConfig(payload, CONFIG.SECRETS.PEERTUBE))
    await RedisChannels.configChanged.publish()
  }

  private async applyPublishedConfig () {
    const raw = await Redis.Instance.getSharedConfig()

    if (!raw) {
      logger.error('The primary process removed the published configuration, keeping the current one.')

      return
    }

    const payload = await decodePublishedConfig(raw, CONFIG.SECRETS.PEERTUBE)
      .catch(err => {
        logger.error(
          'Cannot decrypt the configuration published by the primary process, keeping the current one.\n' +
            'Ensure "secrets.peertube" has the same value as the primary process.',
          { err }
        )

        return null
      })

    if (!payload) return

    if (payload.instance !== WEBSERVER.HOST) {
      logger.error(
        `The configuration published in Redis belongs to "${payload.instance}" but this process is "${WEBSERVER.HOST}", ` +
          'keeping the current one.',
        { publishedInstance: payload.instance, expectedInstance: WEBSERVER.HOST }
      )

      return
    }

    setPublishedConfig(payload.config)

    logger.info('Applying the configuration change published by the primary process.')

    await reloadConfig()

    ClientHtml.invalidateCache()
  }

  // An admin probably copied the configuration of the primary without changing the storage settings
  // Only warn: the primary may run on another server with the same hostname
  private warnOnStorageDirectoriesUsedByPrimary () {
    const settings = findStorageDirectoriesConflictsWithPrimary()
    if (settings.length === 0) return

    logger.warn(
      `${settings.join(', ')} of this process point to directories also used by the primary process on this host. ` +
        'Every process needs storage directories of its own: set them to directories the primary process does not use. ' +
        'Ignore this warning if the primary process runs on another server that has the same hostname.'
    )
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
