import express from 'express'
import { param } from 'express-validator'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isSafePath } from '../../helpers/custom-validators/misc.js'
import { isPluginNameValid, isPluginStableOrUnstableVersionValid } from '../../helpers/custom-validators/plugins.js'
import { PluginManager } from '../../lib/plugins/plugin-manager.js'
import { areValidationErrors } from './shared/index.js'

const serveThemeCSSValidator = [
  param('themeName')
    .custom(isPluginNameValid),
  param('themeVersion')
    .custom(isPluginStableOrUnstableVersionValid),
  param('staticEndpoint')
    .custom(isSafePath),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const theme = PluginManager.Instance.getRegisteredThemeByShortName(req.params.themeName)

    if (!theme || theme.version !== req.params.themeVersion) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'No theme named ' + req.params.themeName + ' was found with version ' + req.params.themeVersion
      })
    }

    if (theme.css.includes(req.params.staticEndpoint) === false) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'No static endpoint was found for this theme'
      })
    }

    res.locals.registeredPlugin = theme

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  serveThemeCSSValidator
}
