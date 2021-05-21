import * as express from 'express'
import { logger } from '@server/helpers/logger'
import { getFormattedObjects } from '@server/helpers/utils'
import { listAvailablePluginsFromIndex } from '@server/lib/plugins/plugin-index'
import { PluginManager } from '@server/lib/plugins/plugin-manager'
import {
  asyncMiddleware,
  authenticate,
  availablePluginsSortValidator,
  ensureUserHasRight,
  paginationValidator,
  pluginsSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '@server/middlewares'
import {
  existingPluginValidator,
  installOrUpdatePluginValidator,
  listAvailablePluginsValidator,
  listPluginsValidator,
  uninstallPluginValidator,
  updatePluginSettingsValidator
} from '@server/middlewares/validators/plugins'
import { PluginModel } from '@server/models/server/plugin'
import { HttpStatusCode } from '@shared/core-utils'
import {
  InstallOrUpdatePlugin,
  ManagePlugin,
  PeertubePluginIndexList,
  PublicServerSetting,
  RegisteredServerSettings,
  UserRight
} from '@shared/models'

const pluginRouter = express.Router()

pluginRouter.get('/available',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  listAvailablePluginsValidator,
  paginationValidator,
  availablePluginsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAvailablePlugins)
)

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

pluginRouter.get('/:npmName/registered-settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  getPluginRegisteredSettings
)

pluginRouter.get('/:npmName/public-settings',
  asyncMiddleware(existingPluginValidator),
  getPublicPluginSettings
)

pluginRouter.put('/:npmName/settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  updatePluginSettingsValidator,
  asyncMiddleware(existingPluginValidator),
  asyncMiddleware(updatePluginSettings)
)

pluginRouter.get('/:npmName',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  getPlugin
)

pluginRouter.post('/install',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(installPlugin)
)

pluginRouter.post('/update',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(updatePlugin)
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
  const pluginType = req.query.pluginType
  const uninstalled = req.query.uninstalled

  const resultList = await PluginModel.listForApi({
    pluginType,
    uninstalled,
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
  const body: InstallOrUpdatePlugin = req.body

  const fromDisk = !!body.path
  const toInstall = body.npmName || body.path
  try {
    const plugin = await PluginManager.Instance.install(toInstall, undefined, fromDisk)

    return res.json(plugin.toFormattedJSON())
  } catch (err) {
    logger.warn('Cannot install plugin %s.', toInstall, { err })
    return res.sendStatus(HttpStatusCode.BAD_REQUEST_400)
  }
}

async function updatePlugin (req: express.Request, res: express.Response) {
  const body: InstallOrUpdatePlugin = req.body

  const fromDisk = !!body.path
  const toUpdate = body.npmName || body.path
  try {
    const plugin = await PluginManager.Instance.update(toUpdate, fromDisk)

    return res.json(plugin.toFormattedJSON())
  } catch (err) {
    logger.warn('Cannot update plugin %s.', toUpdate, { err })
    return res.sendStatus(HttpStatusCode.BAD_REQUEST_400)
  }
}

async function uninstallPlugin (req: express.Request, res: express.Response) {
  const body: ManagePlugin = req.body

  await PluginManager.Instance.uninstall(body.npmName)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

function getPublicPluginSettings (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin
  const registeredSettings = PluginManager.Instance.getRegisteredSettings(req.params.npmName)
  const publicSettings = plugin.getPublicSettings(registeredSettings)

  const json: PublicServerSetting = { publicSettings }

  return res.json(json)
}

function getPluginRegisteredSettings (req: express.Request, res: express.Response) {
  const registeredSettings = PluginManager.Instance.getRegisteredSettings(req.params.npmName)

  const json: RegisteredServerSettings = { registeredSettings }

  return res.json(json)
}

async function updatePluginSettings (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  plugin.settings = req.body.settings
  await plugin.save()

  await PluginManager.Instance.onSettingsChanged(plugin.name, plugin.settings)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listAvailablePlugins (req: express.Request, res: express.Response) {
  const query: PeertubePluginIndexList = req.query

  const resultList = await listAvailablePluginsFromIndex(query)

  if (!resultList) {
    return res.status(HttpStatusCode.SERVICE_UNAVAILABLE_503)
      .json({ error: 'Plugin index unavailable. Please retry later' })
  }

  return res.json(resultList)
}
