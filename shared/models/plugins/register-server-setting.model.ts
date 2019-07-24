export interface RegisterServerSettingOptions {
  name: string
  label: string
  type: 'input'
  default?: string
}

export interface RegisteredServerSettings {
  settings: RegisterServerSettingOptions[]
}
