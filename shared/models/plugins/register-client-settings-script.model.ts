import { RegisterClientFormFieldOptions } from "./register-client-form-field.model"

export interface RegisterClientSettingsScript {
  isSettingHidden (options: {
    setting: RegisterClientFormFieldOptions
    formValues: { [name: string]: any }
  }): boolean
}
