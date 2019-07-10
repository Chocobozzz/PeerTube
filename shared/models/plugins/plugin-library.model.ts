import { RegisterOptions } from './register-options.model'

export interface PluginLibrary {
  register: (options: RegisterOptions) => void

  unregister: () => Promise<any>
}
