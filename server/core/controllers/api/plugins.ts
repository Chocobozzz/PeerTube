import express from 'express'
import { logger } from '@server/helpers/logger.js'
import { getFormattedObjects } from '@server/helpers/utils.js'
import { listAvailablePluginsFromIndex } from '@server/lib/plugins/plugin-index.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  availablePluginsSortValidator,
  ensureUserHasRight,
  openapiOperationDoc,
  paginationValidator,
  pluginsSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '@server/middlewares/index.js'
import {
  existingPluginValidator,
  installOrUpdatePluginValidator,
  listAvailablePluginsValidator,
  listPluginsValidator,
  uninstallPluginValidator,
  updatePluginSettingsValidator
} from '@server/middlewares/validators/plugins.js'
import { PluginModel } from '@server/models/server/plugin.js'
import {
  HttpStatusCode,
  InstallOrUpdatePlugin,
  ManagePlugin,
  PeertubePluginIndexList,
  PublicServerSetting,
  RegisteredServerSettings,
  UserRight
} from '@peertube/peertube-models'
import { CreateJobArgument, JobQueue } from '@server/lib/job-queue/job-queue.js'
import { basename } from 'path'

const pluginRouter = express.Router()

pluginRouter.use(apiRateLimiter)

pluginRouter.get('/available',
  openapiOperationDoc({ operationId: 'getAvailablePlugins' }),
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
  openapiOperationDoc({ operationId: 'getPlugins' }),
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
  openapiOperationDoc({ operationId: 'addPlugin' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(installPlugin)
)

pluginRouter.post('/update',
  openapiOperationDoc({ operationId: 'updatePlugin' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(updatePlugin)
)

pluginRouter.post('/uninstall',
  openapiOperationDoc({ operationId: 'uninstallPlugin' }),
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
  const npmName = body.npmName ?? basename(body.path)

  const pluginVersion = body.pluginVersion && body.npmName
    ? body.pluginVersion
    : undefined
  const options = {
    type: 'plugin-manage',
    payload: {
      action: 'install',
      npmName,
      path: body.path,
      version: pluginVersion,
      userId: res.locals.oauth.token.user.id
    }
  } as CreateJobArgument

  try {
    await JobQueue.Instance.createJob(options)

    return res.status(HttpStatusCode.CREATED_201).end()
  } catch (err) {
    logger.error('Cannot create plugin-install job.', { err, options })
    return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500).end()
  }
}

async function updatePlugin (req: express.Request, res: express.Response) {
  const body: InstallOrUpdatePlugin = req.body
  const npmName = body.npmName ?? basename(body.path)

  const options = {
    type: 'plugin-manage',
    payload: {
      action: 'update',
      npmName,
      path: body.path,
      userId: res.locals.oauth.token.user.id
    }
  } as CreateJobArgument

  try {
    await JobQueue.Instance.createJob(options)

    return res.status(HttpStatusCode.CREATED_201).end()
  } catch (err) {
    logger.error('Cannot create plugin-install job.', { err, options })
    return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500).end()
  }
}

async function uninstallPlugin (req: express.Request, res: express.Response) {
  const body: ManagePlugin = req.body

  try {
    await JobQueue.Instance.createJob({
      type: 'plugin-manage',
      payload: {
        action: 'uninstall',
        npmName: body.npmName,
        userId: res.locals.oauth.token.user.id
      }
    })

    return res.status(HttpStatusCode.CREATED_201).end()
  } catch (err) {
    logger.error('Cannot create plugin-uninstall job for %s.', body.npmName, { err })
    return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500).end()
  }
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

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function listAvailablePlugins (req: express.Request, res: express.Response) {
  const query: PeertubePluginIndexList = req.query

  const resultList = await listAvailablePluginsFromIndex(query)

  if (!resultList) {
    return res.fail({
      status: HttpStatusCode.SERVICE_UNAVAILABLE_503,
      message: 'Plugin index unavailable. Please retry later'
    })
  }

  return res.json(resultList)
}
