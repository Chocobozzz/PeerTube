import { createLogger } from '../../helpers/logger.js'
import { ClientHtml } from '../../lib/html/client-html.js'
import { Redis } from '../../lib/redis/index.js'
import { CONFIG, getConfigModule, reloadConfig } from '../config.js'
import { WEBSERVER } from '../constants.js'
import { isSecondaryProcess } from '../process-role.js'
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
      await Redis.Instance.subscribeToConfigChanges(() => {
        this.applyPublishedConfig()
          .catch(err => logger.error('Cannot apply the configuration change.', { err }))
      })

      logger.info(`Using the configuration published by the primary process of ${WEBSERVER.HOST}.`)

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
      config: buildPublishableConfig(getConfigModule().toObject())
    }

    await Redis.Instance.setSharedConfig(await encodePublishedConfig(payload, CONFIG.SECRETS.PEERTUBE))
    await Redis.Instance.publishConfigChanged()
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

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
