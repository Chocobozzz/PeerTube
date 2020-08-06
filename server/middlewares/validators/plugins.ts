import * as express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isNpmPluginNameValid, isPluginNameValid, isPluginTypeValid, isPluginVersionValid } from '../../helpers/custom-validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { isBooleanValid, isSafePath, toBooleanOrNull, exists, toIntOrNull } from '../../helpers/custom-validators/misc'
import { PluginModel } from '../../models/server/plugin'
import { InstallOrUpdatePlugin } from '../../../shared/models/plugins/install-plugin.model'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { CONFIG } from '../../initializers/config'

const getPluginValidator = (pluginType: PluginType, withVersion = true) => {
  const validators: (ValidationChain | express.Handler)[] = [
    param('pluginName').custom(isPluginNameValid).withMessage('Should have a valid plugin name')
  ]

  if (withVersion) {
    validators.push(
      param('pluginVersion').custom(isPluginVersionValid).withMessage('Should have a valid plugin version')
    )
  }

  return validators.concat([
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking getPluginValidator parameters', { parameters: req.params })

      if (areValidationErrors(req, res)) return

      const npmName = PluginModel.buildNpmName(req.params.pluginName, pluginType)
      const plugin = PluginManager.Instance.getRegisteredPluginOrTheme(npmName)

      if (!plugin) return res.sendStatus(404)
      if (withVersion && plugin.version !== req.params.pluginVersion) return res.sendStatus(404)

      res.locals.registeredPlugin = plugin

      return next()
    }
  ])
}

const getExternalAuthValidator = [
  param('authName').custom(exists).withMessage('Should have a valid auth name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getExternalAuthValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const plugin = res.locals.registeredPlugin
    if (!plugin.registerHelpersStore) return res.sendStatus(404)

    const externalAuth = plugin.registerHelpersStore.getExternalAuths().find(a => a.authName === req.params.authName)
    if (!externalAuth) return res.sendStatus(404)

    res.locals.externalAuth = externalAuth

    return next()
  }
]

const pluginStaticDirectoryValidator = [
  param('staticEndpoint').custom(isSafePath).withMessage('Should have a valid static endpoint'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking pluginStaticDirectoryValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const listPluginsValidator = [
  query('pluginType')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isPluginTypeValid).withMessage('Should have a valid plugin type'),
  query('uninstalled')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid uninstalled attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listPluginsValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const installOrUpdatePluginValidator = [
  body('npmName')
    .optional()
    .custom(isNpmPluginNameValid).withMessage('Should have a valid npm name'),
  body('path')
    .optional()
    .custom(isSafePath).withMessage('Should have a valid safe path'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking installOrUpdatePluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const body: InstallOrUpdatePlugin = req.body
    if (!body.path && !body.npmName) {
      return res.status(400)
                .json({ error: 'Should have either a npmName or a path' })
                .end()
    }

    return next()
  }
]

const uninstallPluginValidator = [
  body('npmName').custom(isNpmPluginNameValid).withMessage('Should have a valid npm name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking uninstallPluginValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const existingPluginValidator = [
  param('npmName').custom(isNpmPluginNameValid).withMessage('Should have a valid plugin name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking enabledPluginValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const plugin = await PluginModel.loadByNpmName(req.params.npmName)
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

const listAvailablePluginsValidator = [
  query('search')
    .optional()
    .exists().withMessage('Should have a valid search'),
  query('pluginType')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isPluginTypeValid).withMessage('Should have a valid plugin type'),
  query('currentPeerTubeEngine')
    .optional()
    .custom(isPluginVersionValid).withMessage('Should have a valid current peertube engine'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking enabledPluginValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (CONFIG.PLUGINS.INDEX.ENABLED === false) {
      return res.status(400)
        .json({ error: 'Plugin index is not enabled' })
        .end()
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  pluginStaticDirectoryValidator,
  getPluginValidator,
  updatePluginSettingsValidator,
  uninstallPluginValidator,
  listAvailablePluginsValidator,
  existingPluginValidator,
  installOrUpdatePluginValidator,
  listPluginsValidator,
  getExternalAuthValidator
}
