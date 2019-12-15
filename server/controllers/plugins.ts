import * as express from 'express'
import { PLUGIN_GLOBAL_CSS_PATH } from '../initializers/constants'
import { join } from 'path'
import { PluginManager, RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { servePluginStaticDirectoryValidator } from '../middlewares/validators/plugins'
import { serveThemeCSSValidator } from '../middlewares/validators/themes'
import { PluginType } from '../../shared/models/plugins/plugin.type'
import { isTestInstance } from '../helpers/core-utils'
import { getCompleteLocale, is18nLocale } from '../../shared/models/i18n'

const sendFileOptions = {
  maxAge: '30 days',
  immutable: !isTestInstance()
}

const pluginsRouter = express.Router()

pluginsRouter.get('/plugins/global.css',
  servePluginGlobalCSS
)

pluginsRouter.get('/plugins/translations/:locale.json',
  getPluginTranslations
)

pluginsRouter.get('/plugins/:pluginName/:pluginVersion/static/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator(PluginType.PLUGIN),
  servePluginStaticDirectory
)

pluginsRouter.get('/plugins/:pluginName/:pluginVersion/client-scripts/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator(PluginType.PLUGIN),
  servePluginClientScripts
)

pluginsRouter.get('/themes/:pluginName/:pluginVersion/static/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator(PluginType.THEME),
  servePluginStaticDirectory
)

pluginsRouter.get('/themes/:pluginName/:pluginVersion/client-scripts/:staticEndpoint(*)',
  servePluginStaticDirectoryValidator(PluginType.THEME),
  servePluginClientScripts
)

pluginsRouter.get('/themes/:themeName/:themeVersion/css/:staticEndpoint(*)',
  serveThemeCSSValidator,
  serveThemeCSSDirectory
)

// ---------------------------------------------------------------------------

export {
  pluginsRouter
}

// ---------------------------------------------------------------------------

function servePluginGlobalCSS (req: express.Request, res: express.Response) {
  // Only cache requests that have a ?hash=... query param
  const globalCSSOptions = req.query.hash
    ? sendFileOptions
    : {}

  return res.sendFile(PLUGIN_GLOBAL_CSS_PATH, globalCSSOptions)
}

function getPluginTranslations (req: express.Request, res: express.Response) {
  const locale = req.params.locale

  if (is18nLocale(locale)) {
    const completeLocale = getCompleteLocale(locale)
    const json = PluginManager.Instance.getTranslations(completeLocale)

    return res.json(json)
  }

  return res.sendStatus(404)
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
  return res.sendFile(join(plugin.path, staticPath, filepath), sendFileOptions)
}

function servePluginClientScripts (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  const file = plugin.clientScripts[staticEndpoint]
  if (!file) {
    return res.sendStatus(404)
  }

  return res.sendFile(join(plugin.path, staticEndpoint), sendFileOptions)
}

function serveThemeCSSDirectory (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  if (plugin.css.includes(staticEndpoint) === false) {
    return res.sendStatus(404)
  }

  return res.sendFile(join(plugin.path, staticEndpoint), sendFileOptions)
}
