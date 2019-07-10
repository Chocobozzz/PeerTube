import { RegisterHookOptions } from './register-hook.model'
import { RegisterSettingOptions } from './register-setting.model'
import { PluginSettingsManager } from './plugin-settings-manager.model'

export type RegisterOptions = {
  registerHook: (options: RegisterHookOptions) => void

  registerSetting: (options: RegisterSettingOptions) => void

  settingsManager: PluginSettingsManager
}
