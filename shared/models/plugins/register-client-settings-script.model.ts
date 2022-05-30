import { RegisterServerSettingOptions } from "./register-server-setting.model"

export interface RegisterClientSettingsScript {
  isSettingHidden (options: {
    setting: RegisterServerSettingOptions
    formValues: { [name: string]: any }
  }): boolean
}
