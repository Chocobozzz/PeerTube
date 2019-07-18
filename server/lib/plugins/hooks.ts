import { ServerActionHookName, ServerFilterHookName } from '../../../shared/models/plugins/server-hook.model'
import { PluginManager } from './plugin-manager'
import { logger } from '../../helpers/logger'
import * as Bluebird from 'bluebird'

// Helpers to run hooks
const Hooks = {
  wrapObject: <T, U extends ServerFilterHookName>(obj: T, hookName: U) => {
    return PluginManager.Instance.runHook(hookName, obj) as Promise<T>
  },

  wrapPromise: async <T, U extends ServerFilterHookName>(fun: Promise<T> | Bluebird<T>, hookName: U) => {
    const result = await fun

    return PluginManager.Instance.runHook(hookName, result)
  },

  runAction: <T, U extends ServerActionHookName>(hookName: U, params?: T) => {
    PluginManager.Instance.runHook(hookName, params)
      .catch(err => logger.error('Fatal hook error.', { err }))
  }
}

export {
  Hooks
}
