import { ServerHookName } from './server-hook.model'

export interface RegisterServerHookOptions {
  target: ServerHookName
  handler: Function
  priority?: number
}
