export interface RegisterServerSettingOptions {
  name: string
  label: string
  type: 'input'

  // If the setting is not private, anyone can view its value
  // Mainly used by the PeerTube client to get admin config
  private: boolean

  // Default setting value
  default?: string
}

export interface RegisteredServerSettings {
  registeredSettings: RegisterServerSettingOptions[]
}
