import { logger } from '../../helpers/logger'
import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'
import { PluginStorageManager } from '../../../shared/models/plugins/plugin-storage-manager.model'
import { RegisterServerHookOptions } from '../../../shared/models/plugins/register-server-hook.model'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'

export type RegisterServerOptions = {
  registerHook: (options: RegisterServerHookOptions) => void

  registerSetting: (options: RegisterServerSettingOptions) => void

  settingsManager: PluginSettingsManager

  storageManager: PluginStorageManager

  peertubeHelpers: {
    logger: typeof logger
  }
}
