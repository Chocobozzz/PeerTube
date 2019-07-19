export interface RegisterSettingOptions {
  name: string
  label: string
  type: 'input'
  default?: string
}

export interface RegisteredSettings {
  settings: RegisterSettingOptions[]
}
