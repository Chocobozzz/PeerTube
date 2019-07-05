import * as express from 'express'
import { PLUGIN_GLOBAL_CSS_PATH } from '../initializers/constants'
import { join } from 'path'
import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { servePluginStaticDirectoryValidator } from '../middlewares/validators/plugins'
import { serveThemeCSSValidator } from '../middlewares/validators/themes'

const themesRouter = express.Router()

themesRouter.get('/:themeName/:themeVersion/css/:staticEndpoint',
  serveThemeCSSValidator,
  serveThemeCSSDirectory
)

// ---------------------------------------------------------------------------

export {
  themesRouter
}

// ---------------------------------------------------------------------------

function serveThemeCSSDirectory (req: express.Request, res: express.Response) {
  const plugin: RegisteredPlugin = res.locals.registeredPlugin
  const staticEndpoint = req.params.staticEndpoint

  return express.static(join(plugin.path, staticEndpoint), { fallthrough: false })
}
