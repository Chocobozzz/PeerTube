import { Job } from 'bullmq'
import { PluginManagePayload } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { PluginModel } from '@server/models/server/plugin.js'

async function processPluginManage (job: Job) {
  const payload = job.data as PluginManagePayload
  let hasError = false
  let pluginId: number
  logger.info('Processing plugin manage in job %s.', job.id)

  switch (payload.action) {
    case 'install': {
      const toInstall = payload.path || payload.npmName
      const fromDisk = !!payload.path

      try {
        const plugin = await PluginManager.Instance.install({
          fromDisk,
          toInstall,
          version: payload.version
        })
        pluginId = plugin.id
      } catch (err) {
        hasError = true
        logger.warn('Cannot install plugin %s.', toInstall, { err })
      }
      break
    }
    case 'update': {
      const toUpdate = payload.path || payload.npmName
      const fromDisk = !!payload.path

      try {
        const plugin = await PluginManager.Instance.update(toUpdate, fromDisk)
        pluginId = plugin.id
      } catch (err) {
        hasError = true
        logger.warn('Cannot update plugin %s.', toUpdate, { err })
      }
      break
    }
    case 'uninstall':
      try {
        const plugin = await PluginModel.loadByNpmName(payload.npmName)
        pluginId = plugin.id
        await PluginManager.Instance.uninstall(payload)
      } catch (err) {
        hasError = true
        logger.warn('Cannot uninstall plugin %s.', payload.npmName, { err })
      }
      break
  }

  Notifier.Instance.notifyOfPluginManageFinished(payload, pluginId, hasError)
}

// ---------------------------------------------------------------------------

export {
  processPluginManage
}
