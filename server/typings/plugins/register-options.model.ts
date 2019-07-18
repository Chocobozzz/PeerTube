import { logger } from '../../helpers/logger'
import { RegisterHookOptions } from '../../../shared/models/plugins/register-hook.model'
import { RegisterSettingOptions } from '../../../shared/models/plugins/register-setting.model'
import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'
import { PluginStorageManager } from '../../../shared/models/plugins/plugin-storage-manager.model'

export type RegisterOptions = {
  registerHook: (options: RegisterHookOptions) => void

  registerSetting: (options: RegisterSettingOptions) => void

  settingsManager: PluginSettingsManager

  storageManager: PluginStorageManager

  peertubeHelpers: {
    logger: typeof logger
  }
}
