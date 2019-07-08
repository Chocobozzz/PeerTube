import * as express from 'express'
import { PLUGIN_GLOBAL_CSS_PATH } from '../initializers/constants'
import { basename, join } from 'path'
import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { servePluginStaticDirectoryValidator } from '../middlewares/validators/plugins'

const pluginsRouter = express.Router()

pluginsRouter.get('/global.css',
  servePluginGlobalCSS
)

pluginsRouter.get('/:pluginName/:pluginVersion/static/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator,
  servePluginStaticDirectory
)

pluginsRouter.get('/:pluginName/:pluginVersion/client-scripts/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator,
  servePluginClientScripts
)

// ---------------------------------------------------------------------------

export {
  pluginsRouter
}

// ---------------------------------------------------------------------------

function servePluginGlobalCSS (req: express.Request, res: express.Response) {
  return res.sendFile(PLUGIN_GLOBAL_CSS_PATH)
}

function servePluginStaticDirectory (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  const [ directory, ...file ] = staticEndpoint.split('/')

  const staticPath = plugin.staticDirs[directory]
  if (!staticPath) {
    return res.sendStatus(404)
  }

  const filepath = file.join('/')
  return res.sendFile(join(plugin.path, staticPath, filepath))
}

function servePluginClientScripts (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  const file = plugin.clientScripts[staticEndpoint]
  if (!file) {
    return res.sendStatus(404)
  }

  return res.sendFile(join(plugin.path, staticEndpoint))
}
