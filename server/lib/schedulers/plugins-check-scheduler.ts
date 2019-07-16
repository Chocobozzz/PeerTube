import { logger } from '../../helpers/logger'
import { AbstractScheduler } from './abstract-scheduler'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { CONFIG } from '../../initializers/config'
import { PluginModel } from '../../models/server/plugin'
import { chunk } from 'lodash'
import { getLatestPluginsVersion } from '../plugins/plugin-index'
import { compareSemVer } from '../../../shared/core-utils/miscs/miscs'

export class PluginsCheckScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.checkPlugins

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return retryTransactionWrapper(this.checkLatestPluginsVersion.bind(this))
  }

  private async checkLatestPluginsVersion () {
    if (CONFIG.PLUGINS.INDEX.ENABLED === false) return

    logger.info('Checkin latest plugins version.')

    const plugins = await PluginModel.listInstalled()

    // Process 10 plugins in 1 HTTP request
    const chunks = chunk(plugins, 10)
    for (const chunk of chunks) {
      // Find plugins according to their npm name
      const pluginIndex: { [npmName: string]: PluginModel} = {}
      for (const plugin of chunk) {
        pluginIndex[PluginModel.buildNpmName(plugin.name, plugin.type)] = plugin
      }

      const npmNames = Object.keys(pluginIndex)
      const results = await getLatestPluginsVersion(npmNames)

      for (const result of results) {
        const plugin = pluginIndex[result.npmName]
        if (!result.latestVersion) continue

        if (plugin.latestVersion !== result.latestVersion && compareSemVer(plugin.latestVersion, result.latestVersion) < 0) {
          plugin.latestVersion = result.latestVersion
          await plugin.save()
        }
      }
    }

  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
