import * as express from 'express'
import { join } from 'path'
import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { serveThemeCSSValidator } from '../middlewares/validators/themes'

const themesRouter = express.Router()

themesRouter.get('/:themeName/:themeVersion/css/:staticEndpoint(*)',
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

  if (plugin.css.includes(staticEndpoint) === false) {
    return res.sendStatus(404)
  }

  return res.sendFile(join(plugin.path, staticEndpoint))
}
