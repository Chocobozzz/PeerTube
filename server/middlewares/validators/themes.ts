import * as express from 'express'
import { param } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isPluginNameValid, isPluginVersionValid } from '../../helpers/custom-validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { isSafePath } from '../../helpers/custom-validators/misc'

const serveThemeCSSValidator = [
  param('themeName').custom(isPluginNameValid).withMessage('Should have a valid theme name'),
  param('themeVersion').custom(isPluginVersionValid).withMessage('Should have a valid theme version'),
  param('staticEndpoint').custom(isSafePath).withMessage('Should have a valid static endpoint'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking serveThemeCSS parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const theme = PluginManager.Instance.getRegisteredThemeByShortName(req.params.themeName)

    if (!theme || theme.version !== req.params.themeVersion) {
      return res.sendStatus(404)
    }

    if (theme.css.includes(req.params.staticEndpoint) === false) {
      return res.sendStatus(404)
    }

    res.locals.registeredPlugin = theme

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  serveThemeCSSValidator
}
