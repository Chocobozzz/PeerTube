import { HttpStatusCode, InstallOrUpdatePlugin, PluginType_Type } from '@peertube/peertube-models'
import express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import {
  exists,
  isBooleanValid,
  isSafePath,
  isStableOrUnstableVersionValid,
  toBooleanOrNull,
  toIntOrNull
} from '../../helpers/custom-validators/misc.js'
import { isNpmPluginNameValid, isPluginNameValid, isPluginTypeValid } from '../../helpers/custom-validators/plugins.js'
import { CONFIG } from '../../initializers/config.js'
import { PluginManager } from '../../lib/plugins/plugin-manager.js'
import { PluginModel } from '../../models/server/plugin.js'
import { areValidationErrors } from './shared/index.js'

export const getPluginValidator = (pluginType: PluginType_Type, withVersion = true) => {
  const validators: (ValidationChain | express.Handler)[] = [
    param('pluginName')
      .custom(isPluginNameValid)
  ]

  if (withVersion) {
    validators.push(
      param('pluginVersion')
        .custom(isStableOrUnstableVersionValid)
    )
  }

  return validators.concat([
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const npmName = PluginModel.buildNpmName(req.params.pluginName, pluginType)
      const plugin = PluginManager.Instance.getRegisteredPluginOrTheme(npmName)

      if (!plugin) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'No plugin found named ' + npmName
        })
      }
      if (withVersion && plugin.version !== req.params.pluginVersion) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'No plugin found named ' + npmName + ' with version ' + req.params.pluginVersion
        })
      }

      res.locals.registeredPlugin = plugin

      return next()
    }
  ])
}

export const getExternalAuthValidator = [
  param('authName')
    .custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const plugin = res.locals.registeredPlugin
    if (!plugin.registerHelpers) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'No registered helpers were found for this plugin'
      })
    }

    const externalAuth = plugin.registerHelpers.getExternalAuths().find(a => a.authName === req.params.authName)
    if (!externalAuth) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'No external auths were found for this plugin'
      })
    }

    res.locals.externalAuth = externalAuth

    return next()
  }
]

export const pluginStaticDirectoryValidator = [
  param('staticEndpoint')
    .custom(isSafePath),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const listPluginsValidator = [
  query('pluginType')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isPluginTypeValid),
  query('uninstalled')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const installOrUpdatePluginValidator = [
  body('npmName')
    .optional()
    .custom(isNpmPluginNameValid),
  body('pluginVersion')
    .optional()
    .custom(isStableOrUnstableVersionValid),
  body('path')
    .optional()
    .custom(isSafePath),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body: InstallOrUpdatePlugin = req.body
    if (!body.path && !body.npmName) {
      return res.fail({ message: 'Should have either a npmName or a path' })
    }
    if (body.pluginVersion && !body.npmName) {
      return res.fail({ message: 'Should have a npmName when specifying a pluginVersion' })
    }

    return next()
  }
]

export const uninstallPluginValidator = [
  body('npmName')
    .custom(isNpmPluginNameValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const existingPluginValidator = [
  param('npmName')
    .custom(isNpmPluginNameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const plugin = await PluginModel.loadByNpmName(req.params.npmName)
    if (!plugin) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Plugin not found'
      })
    }

    res.locals.plugin = plugin
    return next()
  }
]

export const updatePluginSettingsValidator = [
  body('settings')
    .exists(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const listAvailablePluginsValidator = [
  query('search')
    .optional()
    .exists(),
  query('pluginType')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isPluginTypeValid),
  query('currentPeerTubeEngine')
    .optional()
    .custom(isStableOrUnstableVersionValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (CONFIG.PLUGINS.INDEX.ENABLED === false) {
      return res.fail({ message: 'Plugin index is not enabled' })
    }

    return next()
  }
]
