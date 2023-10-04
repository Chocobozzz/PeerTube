import Bluebird from 'bluebird'
import { ServerActionHookName, ServerFilterHookName } from '@peertube/peertube-models'
import { logger } from '../../helpers/logger.js'
import { PluginManager } from './plugin-manager.js'

type PromiseFunction <U, T> = (params: U) => Promise<T> | Bluebird<T>
type RawFunction <U, T> = (params: U) => T

// Helpers to run hooks
const Hooks = {
  wrapObject: <T, U extends ServerFilterHookName>(result: T, hookName: U, context?: any) => {
    return PluginManager.Instance.runHook(hookName, result, context)
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
