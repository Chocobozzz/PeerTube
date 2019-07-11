import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { pluginsSortValidator } from '../../middlewares/validators'
import { PluginModel } from '../../models/server/plugin'
import { UserRight } from '../../../shared/models/users'
import {
  existingPluginValidator,
  installPluginValidator,
  listPluginsValidator,
  uninstallPluginValidator,
  updatePluginSettingsValidator
} from '../../middlewares/validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { InstallPlugin } from '../../../shared/models/plugins/install-plugin.model'
import { ManagePlugin } from '../../../shared/models/plugins/manage-plugin.model'

const pluginRouter = express.Router()

pluginRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  listPluginsValidator,
  paginationValidator,
  pluginsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listPlugins)
)

pluginRouter.get('/:npmName',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  getPlugin
)

pluginRouter.get('/:npmName/registered-settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  asyncMiddleware(getPluginRegisteredSettings)
)

pluginRouter.put('/:npmName/settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  updatePluginSettingsValidator,
  asyncMiddleware(existingPluginValidator),
  asyncMiddleware(updatePluginSettings)
)

pluginRouter.post('/install',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installPluginValidator,
  asyncMiddleware(installPlugin)
)

pluginRouter.post('/uninstall',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  uninstallPluginValidator,
  asyncMiddleware(uninstallPlugin)
)

// ---------------------------------------------------------------------------

export {
  pluginRouter
}

// ---------------------------------------------------------------------------

async function listPlugins (req: express.Request, res: express.Response) {
  const type = req.query.type

  const resultList = await PluginModel.listForApi({
    type,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

function getPlugin (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  return res.json(plugin.toFormattedJSON())
}

async function installPlugin (req: express.Request, res: express.Response) {
  const body: InstallPlugin = req.body

  await PluginManager.Instance.install(body.npmName)

  return res.sendStatus(204)
}

async function uninstallPlugin (req: express.Request, res: express.Response) {
  const body: ManagePlugin = req.body

  await PluginManager.Instance.uninstall(body.npmName)

  return res.sendStatus(204)
}

async function getPluginRegisteredSettings (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  const settings = await PluginManager.Instance.getSettings(plugin.name)

  return res.json({
    settings
  })
}

async function updatePluginSettings (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  plugin.settings = req.body.settings
  await plugin.save()

  return res.sendStatus(204)
}
