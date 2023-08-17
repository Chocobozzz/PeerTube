import { ClientHookName } from './client-hook.model.js'

export interface RegisterClientHookOptions {
  target: ClientHookName
  handler: Function
  priority?: number
}
