import * as express from 'express'
import { param } from 'express-validator/check'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isPluginNameValid, isPluginVersionValid } from '../../helpers/custom-validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { isSafePath } from '../../helpers/custom-validators/misc'

const servePluginStaticDirectoryValidator = [
  param('pluginName').custom(isPluginNameValid).withMessage('Should have a valid plugin name'),
  param('pluginVersion').custom(isPluginVersionValid).withMessage('Should have a valid plugin version'),
  param('staticEndpoint').custom(isSafePath).withMessage('Should have a valid static endpoint'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking servePluginStaticDirectory parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const plugin = PluginManager.Instance.getRegisteredPlugin(req.params.pluginName)

    if (!plugin || plugin.version !== req.params.pluginVersion) {
      return res.sendStatus(404)
    }

    res.locals.registeredPlugin = plugin

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  servePluginStaticDirectoryValidator
}
