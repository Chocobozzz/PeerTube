export interface RegisterServerSettingOptions {
  name: string
  label: string
  type: 'input' | 'input-checkbox' | 'input-textarea' | 'markdown-text' | 'markdown-enhanced'

  // If the setting is not private, anyone can view its value (client code included)
  // If the setting is private, only server-side hooks can access it
  // Mainly used by the PeerTube client to get admin config
  private: boolean

  // Default setting value
  default?: string | boolean
}

export interface RegisteredServerSettings {
  registeredSettings: RegisterServerSettingOptions[]
}
