import { RegisterServerSettingOptions } from '../server'

export interface RegisterClientSettingsScript {
  isSettingHidden (options: {
    setting: RegisterServerSettingOptions
    formValues: { [name: string]: any }
  }): boolean
}
