import { RegisterServerSettingOptions } from '../server'

export interface RegisterClientSettingsScriptOptions {
  isSettingHidden (options: {
    setting: RegisterServerSettingOptions
    formValues: { [name: string]: any }
  }): boolean
}
