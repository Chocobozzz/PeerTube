import { RegisterServerSettingOptions } from '../server/index.js'

export interface RegisterClientSettingsScriptOptions {
  isSettingHidden (options: {
    setting: RegisterServerSettingOptions
    formValues: { [name: string]: any }
  }): boolean
}
