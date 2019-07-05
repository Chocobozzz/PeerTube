import { RegisterOptions } from './register-options.type'

export interface PluginLibrary {
  register: (options: RegisterOptions) => void
  unregister: () => Promise<any>
}
