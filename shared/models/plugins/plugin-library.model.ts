import { RegisterOptions } from './register-options.model'

export interface PluginLibrary {
  register: (options: RegisterOptions) => Promise<any>

  unregister: () => Promise<any>
}
