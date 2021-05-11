import { RegisterClientFormFieldOptions } from '../../client'

export type RegisterServerSettingOptions = RegisterClientFormFieldOptions & {
  // If the setting is not private, anyone can view its value (client code included)
  // If the setting is private, only server-side hooks can access it
  // Mainly used by the PeerTube client to get admin config
  private: boolean
}

export interface RegisteredServerSettings {
  registeredSettings: RegisterServerSettingOptions[]
}
