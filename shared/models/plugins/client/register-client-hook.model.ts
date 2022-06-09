import { ClientHookName } from './client-hook.model'

export interface RegisterClientHookOptions {
  target: ClientHookName
  handler: Function
  priority?: number
}
