import { ServerActionHookName, ServerFilterHookName } from '../../../shared/models/plugins/server-hook.model'
import { PluginManager } from './plugin-manager'
import { logger } from '../../helpers/logger'
import * as Bluebird from 'bluebird'

type PromiseFunction <U, T> = (params: U) => Promise<T> | Bluebird<T>
type RawFunction <U, T> = (params: U) => T

// Helpers to run hooks
const Hooks = {
  wrapObject: <T, U extends ServerFilterHookName>(result: T, hookName: U) => {
    return PluginManager.Instance.runHook(hookName, result)
  },

  wrapPromiseFun: async <U, T, V extends ServerFilterHookName>(fun: PromiseFunction<U, T>, params: U, hookName: V) => {
    const result = await fun(params)

    return PluginManager.Instance.runHook(hookName, result, params)
  },

  wrapFun: async <U, T, V extends ServerFilterHookName>(fun: RawFunction<U, T>, params: U, hookName: V) => {
    const result = fun(params)

    return PluginManager.Instance.runHook(hookName, result, params)
  },

  runAction: <T, U extends ServerActionHookName>(hookName: U, params?: T) => {
    PluginManager.Instance.runHook(hookName, undefined, params)
      .catch(err => logger.error('Fatal hook error.', { err }))
  }
}

export {
  Hooks
}
