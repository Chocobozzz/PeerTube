import * as express from 'express'
import { param, query, body } from 'express-validator/check'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isPluginNameValid, isPluginTypeValid, isPluginVersionValid, isNpmPluginNameValid } from '../../helpers/custom-validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { isBooleanValid, isSafePath } from '../../helpers/custom-validators/misc'
import { PluginModel } from '../../models/server/plugin'

const servePluginStaticDirectoryValidator = [
  param('pluginName').custom(isPluginNameValid).withMessage('Should have a valid plugin name'),
  param('pluginVersion').custom(isPluginVersionValid).withMessage('Should have a valid plugin version'),
  param('staticEndpoint').custom(isSafePath).withMessage('Should have a valid static endpoint'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking servePluginStaticDirectory parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const plugin = PluginManager.Instance.getRegisteredPluginOrTheme(req.params.pluginName)

    if (!plugin || plugin.version !== req.params.pluginVersion) {
      return res.sendStatus(404)
    }

    res.locals.registeredPlugin = plugin

    return next()
  }
]

const listPluginsValidator = [
  query('type')
    .optional()
    .custom(isPluginTypeValid).withMessage('Should have a valid plugin type'),
  query('uninstalled')
    .optional()
    .toBoolean()
    .custom(isBooleanValid).withMessage('Should have a valid uninstalled attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listPluginsValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const installPluginValidator = [
  body('npmName').custom(isNpmPluginNameValid).withMessage('Should have a valid npm name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking installPluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const uninstallPluginValidator = [
  body('npmName').custom(isNpmPluginNameValid).withMessage('Should have a valid npm name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking managePluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const enabledPluginValidator = [
  body('name').custom(isPluginNameValid).withMessage('Should have a valid plugin name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking enabledPluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const plugin = await PluginModel.load(req.body.name)
    if (!plugin) {
      return res.status(404)
         .json({ error: 'Plugin not found' })
         .end()
    }

    res.locals.plugin = plugin

    return next()
  }
]

const updatePluginSettingsValidator = [
  body('settings').exists().withMessage('Should have settings'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking enabledPluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  servePluginStaticDirectoryValidator,
  updatePluginSettingsValidator,
  uninstallPluginValidator,
  enabledPluginValidator,
  installPluginValidator,
  listPluginsValidator
}
