import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'
import { PluginStorageManager } from '../../../shared/models/plugins/plugin-storage-manager.model'
import { RegisterServerHookOptions } from '../../../shared/models/plugins/register-server-hook.model'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'
import { PluginVideoCategoryManager } from '../../../shared/models/plugins/plugin-video-category-manager.model'
import { PluginVideoLanguageManager } from '../../../shared/models/plugins/plugin-video-language-manager.model'
import { PluginVideoLicenceManager } from '../../../shared/models/plugins/plugin-video-licence-manager.model'
import { Logger } from 'winston'

export type PeerTubeHelpers = {
  logger: Logger

  database: {
    query: Function
  }

  videos: {
    removeVideo: (videoId: number) => Promise<void>
  }
}

export type RegisterServerOptions = {
  registerHook: (options: RegisterServerHookOptions) => void

  registerSetting: (options: RegisterServerSettingOptions) => void

  settingsManager: PluginSettingsManager

  storageManager: PluginStorageManager

  videoCategoryManager: PluginVideoCategoryManager
  videoLanguageManager: PluginVideoLanguageManager
  videoLicenceManager: PluginVideoLicenceManager

  peertubeHelpers: PeerTubeHelpers
}
