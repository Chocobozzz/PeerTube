import * as express from 'express'
import { PLUGIN_GLOBAL_CSS_PATH } from '../initializers/constants'
import { join } from 'path'
import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { servePluginStaticDirectoryValidator } from '../middlewares/validators/plugins'

const pluginsRouter = express.Router()

pluginsRouter.get('/global.css',
  express.static(PLUGIN_GLOBAL_CSS_PATH, { fallthrough: false })
)

pluginsRouter.get('/:pluginName/:pluginVersion/statics/:staticEndpoint',
  servePluginStaticDirectoryValidator,
  servePluginStaticDirectory
)

pluginsRouter.get('/:pluginName/:pluginVersion/client-scripts/:staticEndpoint',
  servePluginStaticDirectoryValidator,
  servePluginClientScripts
)

// ---------------------------------------------------------------------------

export {
  pluginsRouter
}

// ---------------------------------------------------------------------------

function servePluginStaticDirectory (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  const staticPath = plugin.staticDirs[staticEndpoint]
  if (!staticPath) {
    return res.sendStatus(404)
  }

  return express.static(join(plugin.path, staticPath), { fallthrough: false })
}

function servePluginClientScripts (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  return express.static(join(plugin.path, staticEndpoint), { fallthrough: false })
}
