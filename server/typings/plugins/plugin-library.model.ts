import { RegisterServerOptions } from './register-server-option.model'

export interface PluginLibrary {
  register: (options: RegisterServerOptions) => Promise<any>

  unregister: () => Promise<any>
}
