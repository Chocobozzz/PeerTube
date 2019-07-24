import { RegisterClientOptions } from './register-client-option.model'

export interface ClientScript {
  register: (options: RegisterClientOptions) => Promise<any>
}
