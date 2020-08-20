import { getHookType, internalRunHook } from '@shared/core-utils/plugins/hooks'
import { ClientHookName, ClientScript, RegisterClientHookOptions, ServerConfigPlugin, PluginType, clientHookObject } from '../../../shared/models'
import { RegisterClientHelpers } from 'src/types/register-client-option.model'
import { ClientScript as ClientScriptModule } from '../types/client-script.model'
import { importModule } from './utils'

interface HookStructValue extends RegisterClientHookOptions {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
}

type Hooks = { [ name: string ]: HookStructValue[] }

type PluginInfo = {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
  pluginType: PluginType
  isTheme: boolean
}

async function runHook<T> (hooks: Hooks, hookName: ClientHookName, result?: T, params?: any) {
  if (!hooks[hookName]) return result

  const hookType = getHookType(hookName)

  for (const hook of hooks[hookName]) {
    console.log('Running hook %s of plugin %s.', hookName, hook.plugin.name)

    result = await internalRunHook(hook.handler, hookType, result, params, err => {
      console.error('Cannot run hook %s of script %s of plugin %s.', hookName, hook.clientScript.script, hook.plugin.name, err)
    })
  }

  return result
}

function loadPlugin (hooks: Hooks, pluginInfo: PluginInfo, peertubeHelpersFactory: (pluginInfo: PluginInfo) => RegisterClientHelpers) {
  const { plugin, clientScript } = pluginInfo

  const registerHook = (options: RegisterClientHookOptions) => {
    if (clientHookObject[options.target] !== true) {
      console.error('Unknown hook %s of plugin %s. Skipping.', options.target, plugin.name)
      return
    }

    if (!hooks[options.target]) hooks[options.target] = []

    hooks[options.target].push({
      plugin,
      clientScript,
      target: options.target,
      handler: options.handler,
      priority: options.priority || 0
    })
  }

  const peertubeHelpers = peertubeHelpersFactory(pluginInfo)

  console.log('Loading script %s of plugin %s.', clientScript.script, plugin.name)

  return importModule(clientScript.script)
    .then((script: ClientScriptModule) => script.register({ registerHook, peertubeHelpers }))
    .then(() => sortHooksByPriority(hooks))
    .catch(err => console.error('Cannot import or register plugin %s.', pluginInfo.plugin.name, err))
}

export {
  HookStructValue,
  Hooks,
  PluginInfo,
  loadPlugin,
  runHook
}

function sortHooksByPriority (hooks: Hooks) {
  for (const hookName of Object.keys(hooks)) {
    hooks[hookName].sort((a, b) => {
      return b.priority - a.priority
    })
  }
}
