import { RegisterServerOptions } from './register-server-option.model.js'

export interface PluginLibrary {
  register: (options: RegisterServerOptions) => Promise<any>

  unregister: () => Promise<any>
}
